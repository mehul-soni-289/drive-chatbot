"""
Google Drive service — direct API access per user.

Replaces the MCP stdio approach with the official Google Drive API
so that each authenticated user can access their own Drive.
"""

import io
import logging
from typing import Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

logger = logging.getLogger(__name__)


class GoogleDriveService:
    """Per-user Google Drive client."""

    def __init__(self, credentials: Credentials):
        self.service = build("drive", "v3", credentials=credentials)
        logger.info("Google Drive service initialized")

    def search_files(self, query: str, max_results: int = 15, folder_id: Optional[str] = None) -> list[dict]:
        """
        Search for files in the user's Drive, including Shared Drives.
        """
        # Convert natural language to Drive API query
        drive_query = f"fullText contains '{query}' and trashed = false"
        if folder_id:
            drive_query += f" and '{folder_id}' in parents"

        try:
            results = (
                self.service.files()
                .list(
                    q=drive_query,
                    pageSize=max_results,
                    fields="files(id, name, mimeType, modifiedTime, size)",
                    orderBy="modifiedTime desc",
                    # Search ALL drives (My Drive + Shared Drives)
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True,
                    corpora="allDrives",
                )
                .execute()
            )
            files = results.get("files", [])
            logger.info("Drive search '%s' (folder: %s): found %d files", query, folder_id, len(files))
            return files
        except Exception as exc:
            logger.error("Drive search failed: %s", exc)
            return []

    def download_file(self, file_id: str) -> Optional[tuple[bytes, str, str]]:
        """
        Download a file's content by ID.
        """
        try:
            # Get file metadata
            meta = (
                self.service.files()
                .get(
                    fileId=file_id, 
                    fields="id, name, mimeType, size",
                    supportsAllDrives=True
                )
                .execute()
            )
            mime = meta.get("mimeType", "")
            name = meta.get("name", "unknown")

            # Google Workspace files need to be exported
            export_mimes = {
                "application/vnd.google-apps.document": "text/plain",
                "application/vnd.google-apps.spreadsheet": "text/csv",
                "application/vnd.google-apps.presentation": "text/plain",
                "application/vnd.google-apps.drawing": "application/pdf",
            }

            if mime in export_mimes:
                export_mime = export_mimes[mime]
                request = self.service.files().export_media(
                    fileId=file_id, mimeType=export_mime
                )
                buffer = io.BytesIO()
                downloader = MediaIoBaseDownload(buffer, request)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
                raw_bytes = buffer.getvalue()
                return raw_bytes, export_mime, name
            else:
                # Regular file — direct download
                request = self.service.files().get_media(fileId=file_id, supportsAllDrives=True)
                buffer = io.BytesIO()
                downloader = MediaIoBaseDownload(buffer, request)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
                raw_bytes = buffer.getvalue()
                return raw_bytes, mime, name

        except Exception as exc:
            logger.error("Failed to download file %s: %s", file_id, exc)
            return None

    def list_recent_files(self, max_results: int = 20) -> list[dict]:
        """List the user's most recently modified files across all drives."""
        try:
            results = (
                self.service.files()
                .list(
                    pageSize=max_results,
                    fields="files(id, name, mimeType, modifiedTime, size)",
                    orderBy="modifiedTime desc",
                    q="trashed = false",
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True,
                    corpora="allDrives",
                )
                .execute()
            )
            return results.get("files", [])
        except Exception as exc:
            logger.error("Failed to list recent files: %s", exc)
            return []

    def list_folder_contents(self, folder_id: str = "root", max_results: int = 100) -> list[dict]:
        """List contents of a specific folder or Shared Drive root."""
        # Note: If folder_id is a Shared Drive ID, 'folder_id in parents' might sometimes 
        # fail if not using corpora=drive. We use corpora=allDrives to be safe.
        query = f"'{folder_id}' in parents and trashed = false"
        try:
            results = (
                self.service.files()
                .list(
                    q=query,
                    pageSize=max_results,
                    fields="files(id, name, mimeType, modifiedTime, size)",
                    orderBy="folder,name",
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True,
                    corpora="allDrives",
                )
                .execute()
            )
            files = results.get("files", [])
            
            # Fallback: If it's a Shared Drive, maybe the root query is different
            if not files and folder_id != "root":
                logger.info("Folder %s returned no files, trying as Shared Drive root...", folder_id)
                results = (
                    self.service.files()
                    .list(
                        q="'root' in parents and trashed = false",
                        corpora="drive",
                        driveId=folder_id,
                        supportsAllDrives=True,
                        includeItemsFromAllDrives=True,
                        fields="files(id, name, mimeType, modifiedTime, size)",
                    )
                    .execute()
                )
                files = results.get("files", [])

            return files
        except Exception as exc:
            logger.error("Failed to list folder %s: %s", folder_id, exc)
            return []

    def list_folders(self, max_results: int = 100) -> list[dict]:
        """List folders from My Drive, Shared with me, and the root of Shared Drives."""
        all_folders = []
        
        try:
            # 1. Fetch regular folders
            query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            results = (
                self.service.files()
                .list(
                    q=query,
                    pageSize=max_results,
                    fields="files(id, name, modifiedTime, shared, driveId)",
                    orderBy="name",
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True,
                    corpora="allDrives",
                )
                .execute()
            )
            all_folders.extend(results.get("files", []))
            
            # 2. Fetch Shared Drives roots
            drives_results = (
                self.service.drives()
                .list(pageSize=50, fields="drives(id, name)")
                .execute()
            )
            for drive in drives_results.get("drives", []):
                all_folders.append({
                    "id": drive["id"],
                    "name": f"Shared Drive: {drive['name']}",
                    "modifiedTime": None,
                    "isDrive": True
                })

            all_folders.sort(key=lambda x: x["name"].lower())
            return all_folders[:max_results]
            
        except Exception as exc:
            logger.error("Failed to list folders/drives: %s", exc)
            try:
                query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
                res = self.service.files().list(q=query, pageSize=max_results).execute()
                return res.get("files", [])
            except:
                return []
            
        except Exception as exc:
            logger.error("Failed to list folders/drives: %s", exc)
            # Fallback to just regular folders if drives.list fails (e.g. permission)
            try:
                query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
                res = self.service.files().list(q=query, pageSize=max_results).execute()
                return res.get("files", [])
            except:
                return []
