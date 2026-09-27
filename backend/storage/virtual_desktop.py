import os
import json
import uuid
import shutil
from datetime import datetime
from typing import List, Dict, Optional, Any

BASE_STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "virtual_desktop")

CATEGORIES = ["images", "documents", "code", "exports"]

class VirtualDesktopManager:
    """
    Manages user's persistent Virtual Desktop files and metadata.
    Avoids transient caches by organizing generated visual assets, code outputs,
    and documents into permanent storage accessible via the OS Desktop modal UI.
    """

    def __init__(self, storage_dir: str = BASE_STORAGE_DIR):
        self.storage_dir = storage_dir
        self.index_file = os.path.join(self.storage_dir, "desktop_index.json")
        self._ensure_directories()

    def _ensure_directories(self):
        os.makedirs(self.storage_dir, exist_ok=True)
        for cat in CATEGORIES:
            os.makedirs(os.path.join(self.storage_dir, cat), exist_ok=True)

        if not os.path.exists(self.index_file):
            self._save_index([])

    def _load_index(self) -> List[Dict[str, Any]]:
        try:
            if os.path.exists(self.index_file):
                with open(self.index_file, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            print(f"[VirtualDesktop] Error loading index: {e}")
        return []

    def _save_index(self, items: List[Dict[str, Any]]):
        try:
            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump(items, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[VirtualDesktop] Error saving index: {e}")

    def save_file(
        self,
        file_name: str,
        content_bytes: bytes,
        category: str = "documents",
        source_tool: str = "AURA_OS",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Save a file into the virtual desktop directory and update the metadata index."""
        if category not in CATEGORIES:
            category = "documents"

        file_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Clean file name
        base, ext = os.path.splitext(file_name)
        if not ext:
            ext = ".png" if category == "images" else ".txt"

        saved_filename = f"{timestamp}_{file_id}_{base}{ext}"
        cat_dir = os.path.join(self.storage_dir, category)
        full_path = os.path.join(cat_dir, saved_filename)

        with open(full_path, "wb") as f:
            f.write(content_bytes)

        file_record = {
            "id": file_id,
            "name": file_name,
            "filename": saved_filename,
            "category": category,
            "path": full_path,
            "relative_url": f"/api/desktop/file/{file_id}",
            "size_bytes": len(content_bytes),
            "created_at": datetime.now().isoformat(),
            "source_tool": source_tool,
            "metadata": metadata or {}
        }

        index = self._load_index()
        index.insert(0, file_record)
        self._save_index(index)

        return file_record

    def list_files(self, category: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        index = self._load_index()
        filtered = []
        for item in index:
            if category and category != "all" and item.get("category") != category:
                continue
            if search:
                q = search.lower()
                if q not in item.get("name", "").lower() and q not in item.get("source_tool", "").lower():
                    continue
            filtered.append(item)
        return filtered

    def get_file_record(self, file_id: str) -> Optional[Dict[str, Any]]:
        index = self._load_index()
        for item in index:
            if item.get("id") == file_id:
                return item
        return None

    def delete_file(self, file_id: str) -> bool:
        index = self._load_index()
        new_index = []
        deleted = False

        for item in index:
            if item.get("id") == file_id:
                deleted = True
                file_path = item.get("path")
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        print(f"[VirtualDesktop] Error removing file {file_path}: {e}")
            else:
                new_index.append(item)

        if deleted:
            self._save_index(new_index)
        return deleted

# Singleton instance
desktop_manager = VirtualDesktopManager()
