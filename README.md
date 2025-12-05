# Business GPT Desktop Sync App

A desktop application for syncing local files with Business GPT's knowledge base using Pinecone vector storage.

## Features

- **Folder Configuration**: Configure multiple local folders to sync
- **Intelligent Sync**: SHA-256 hashing to detect file changes and avoid duplicate uploads
- **Batch Operations**: Efficient batch uploading and deletion
- **Scheduled Sync**: Automatic syncing on hourly, daily, or weekly schedules
- **Manual Sync**: Trigger syncs manually whenever needed
- **Permission Groups**: Assign documents to groups for access control
- **File Filtering**: Filter by file extensions, size limits, and hidden files
- **Sync History**: View detailed history of all sync runs
- **Cross-Platform**: Works on macOS, Windows, and Linux

## Architecture

### Main Process (Electron)
- **Database Manager**: SQLite database for local file tracking
- **File Scanner**: Recursively scans folders and computes SHA-256 hashes
- **Sync Engine**: Orchestrates the sync process (scan → check → upload → delete)
- **API Client**: Communicates with Business GPT backend
- **Scheduler**: node-cron based scheduler for automated syncs

### Renderer Process (React)
- **Dashboard**: View current sync status and statistics
- **Folders**: Configure which folders to sync
- **Schedule**: Set up automated sync schedules
- **History**: View past sync runs and their results
- **Settings**: Configure API connection

## Setup

### Prerequisites
- Node.js 18+ and npm
- Business GPT backend running
- API token from the admin panel

### Installation

1. Install dependencies:
```bash
cd desktop-sync-app
npm install
```

2. Development mode:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
npm run package
```

### Configuration

1. Launch the app
2. Go to Settings
3. Enter:
   - **API URL**: Your Business GPT backend URL (e.g., `http://localhost:8000`)
   - **API Token**: Token from admin panel (format: `bgpt_xxx...`)
   - **Integration ID**: Leave empty for new integration (will be auto-created)

4. Add folders to sync:
   - Go to Folders page
   - Click "Add Folder"
   - Select local folder path
   - Configure options:
     - Include subfolders
     - File extensions filter
     - Max file size
     - Permission groups
     - Ignore hidden files

5. (Optional) Set up schedule:
   - Go to Schedule page
   - Enable automatic sync
   - Choose frequency (hourly, daily, weekly)
   - Set time and day if applicable

## How It Works

### Sync Process

1. **Scan**: Recursively scan configured folders
   - Compute SHA-256 hash for each file
   - Apply filters (extensions, size, hidden files)
   - Store in local SQLite database

2. **Check**: Query backend for existing files
   - Send batch of hashes to `/check-hash` endpoint
   - Identify new, modified, and unchanged files

3. **Upload**: Upload new/modified files
   - Batch upload (10 files per request)
   - Update local database with document IDs
   - Track success/failure per file

4. **Delete**: Remove files deleted locally
   - Compare local database with scan results
   - Batch delete from backend and Pinecone
   - Update local database

5. **Complete**: Update sync run status
   - Record statistics (scanned, new, updated, deleted, failed)
   - Update integration's last_sync_at timestamp

### Database Schema

**config table**: Key-value pairs for app configuration
- `apiUrl`, `apiToken`, `integrationId`, `companyId`
- `machineId`, `lastSyncAt`
- `schedule` (JSON)

**folder_configs table**: Folder sync configurations
- `id`, `local_path`, `include_subfolders`
- `file_extensions` (JSON array)
- `max_file_size_mb`, `group_ids` (JSON array)
- `ignore_hidden`, `enabled`

**files table**: Tracked file records
- `id`, `file_path`, `file_hash`, `file_size`
- `last_modified`, `document_id`, `folder_config_id`
- `last_synced_at`, `status`, `error_message`

## API Integration

### Endpoints Used

- `POST /integrations/custom` - Create custom integration
- `POST /integrations/custom/{id}/check-hash` - Check if files exist
- `POST /integrations/custom/{id}/upload-batch` - Upload multiple files
- `DELETE /integrations/custom/{id}/documents` - Delete files by hash
- `POST /integrations/custom/{id}/sync-runs` - Create sync run
- `PATCH /integrations/custom/{id}/sync-runs/{runId}` - Update sync progress
- `POST /integrations/custom/{id}/sync-runs/{runId}/complete` - Complete sync
- `GET /integrations/custom/{id}/groups` - Get available groups

## Development

### Project Structure

```
desktop-sync-app/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Entry point
│   │   ├── database.ts    # SQLite database
│   │   ├── scanner.ts     # File scanner
│   │   ├── api-client.ts  # Backend API client
│   │   ├── sync-engine.ts # Sync orchestration
│   │   ├── scheduler.ts   # Cron scheduler
│   │   └── preload.ts     # Preload script
│   ├── renderer/          # React UI
│   │   ├── components/    # UI components
│   │   ├── App.tsx        # Main app
│   │   ├── main.tsx       # Entry point
│   │   └── index.css      # Styles
│   └── shared/            # Shared types
│       └── types.ts       # TypeScript types
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Scripts

- `npm run dev` - Run in development mode
- `npm run build` - Build for production
- `npm run package` - Create distributable packages
- `npm start` - Run built app

## Troubleshooting

### Common Issues

**"API not configured"**
- Go to Settings and enter API URL and token

**"No folder configurations found"**
- Add at least one folder in Folders page

**"Failed to upload files"**
- Check API URL is correct and reachable
- Verify API token is valid
- Check backend logs for errors

**"Permission denied" when scanning**
- Ensure app has file system permissions
- On macOS, grant Full Disk Access in System Settings

## Security

- API tokens stored in local SQLite database (user data directory)
- All API requests use Bearer token authentication
- File hashes (SHA-256) used for deduplication
- No file content stored locally except in original locations

## License

Proprietary - Business GPT
