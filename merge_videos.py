import cv2
import numpy as np

def inspect_video(path):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise Exception(f"Cannot open {path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = frame_count / fps if fps > 0 else 0
    cap.release()
    return {"fps": fps, "frame_count": frame_count, "width": width, "height": height, "duration": duration}

def main():
    print("Inspecting video 1...")
    info1 = inspect_video("1.mp4")
    print(f"Video 1: {info1['width']}x{info1['height']} @ {info1['fps']} FPS, Frames: {info1['frame_count']}, Duration: {info1['duration']:.2f}s")
    
    print("\nInspecting video 2...")
    info2 = inspect_video("2.mp4")
    print(f"Video 2: {info2['width']}x{info2['height']} @ {info2['fps']} FPS, Frames: {info2['frame_count']}, Duration: {info2['duration']:.2f}s")
    
    # Let's read the frames
    cap1 = cv2.VideoCapture("1.mp4")
    cap2 = cv2.VideoCapture("2.mp4")
    
    fps = info1['fps']
    width = info1['width']
    height = info1['height']
    
    # We want:
    # Video 1: exclude the last 1.0 second.
    # Video 2: take only the last 1.5 seconds.
    # Transition: fade-in transition over 1.5 seconds (or whatever matches)
    # Actually, we want to cut Video 1 up to (duration1 - 1.0s), and crossfade it with the last 1.5s of Video 2.
    # Let's calculate frames
    cut_time_1 = info1['duration'] - 1.0
    v1_keep_frames = int(cut_time_1 * fps)
    
    v2_duration = info2['duration']
    v2_start_time = max(0.0, v2_duration - 1.5)
    v2_start_frame = int(v2_start_time * fps)
    v2_keep_frames = info2['frame_count'] - v2_start_frame
    
    print(f"\nProcessing frames:")
    print(f"Video 1: keeping first {v1_keep_frames} frames (up to {cut_time_1:.2f}s)")
    print(f"Video 2: keeping last {v2_keep_frames} frames (from {v2_start_time:.2f}s to {v2_duration:.2f}s)")
    
    frames1 = []
    for i in range(info1['frame_count']):
        ret, frame = cap1.read()
        if not ret:
            break
        if i < v1_keep_frames:
            frames1.append(frame)
            
    frames2 = []
    for i in range(info2['frame_count']):
        ret, frame = cap2.read()
        if not ret:
            break
        if i >= v2_start_frame:
            frames2.append(frame)
            
    cap1.release()
    cap2.release()
    
    # Let's perform a cross-fade overlay.
    # Since Video 2 segment is 1.5 seconds long, we will blend the end of frames1 with frames2.
    # The length of the overlap will be min(len(frames1), len(frames2)) or exactly 1.5s of frames2.
    # Let's cross-fade the ENTIRE frames2 segment (1.5 seconds) over the last 1.5 seconds of frames1.
    overlap_len = len(frames2)
    if len(frames1) < overlap_len:
        print("Warning: Video 1 is shorter than the overlap duration! Crossfading from start.")
        overlap_len = len(frames1)
        
    non_overlap_frames = frames1[:-overlap_len]
    overlap_frames_v1 = frames1[-overlap_len:]
    overlap_frames_v2 = frames2[:overlap_len]
    
    blended_frames = []
    for i in range(overlap_len):
        alpha = i / (overlap_len - 1) if overlap_len > 1 else 1.0
        # Blend frame: (1-alpha)*v1 + alpha*v2
        # Ensure sizes match
        f1 = overlap_frames_v1[i]
        f2 = overlap_frames_v2[i]
        if f1.shape != f2.shape:
            f2 = cv2.resize(f2, (f1.shape[1], f1.shape[0]))
        blended = cv2.addWeighted(f1, 1.0 - alpha, f2, alpha, 0)
        blended_frames.append(blended)
        
    # Append any remaining frames from frames2 if there were more than the overlap length
    remaining_frames = frames2[overlap_len:]
    
    output_frames = non_overlap_frames + blended_frames + remaining_frames
    
    # Write output video
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter("output_merged.mp4", fourcc, fps, (width, height))
    for frame in output_frames:
        out.write(frame)
    out.release()
    print("\nMerged video successfully written to output_merged.mp4!")

if __name__ == "__main__":
    main()
