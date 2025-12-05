# Getting Started with Business GPT Desktop Sync

## Quick Start Guide

### 1. Install Dependencies

```bash
cd desktop-sync-app
npm install
```

### 2. Get Your API Token

1. Open the Business GPT Admin Panel in your browser
2. Log in with your admin credentials
3. Navigate to **API Tokens** in the sidebar
4. Click **Create Token**
5. Fill in the details:
   - **Name**: "Desktop Sync App - [Your Machine Name]"
   - **Scopes**: Leave as default (full access)
   - **Expires At**: Leave empty for no expiration
6. Click **Create**
7. **IMPORTANT**: Copy the token immediately (it won't be shown again)
   - Format: `bgpt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 3. Run the App

```bash
npm run dev
```

### 4. Configure the App

When the app launches, you'll be taken to the Settings page:

1. **API URL**: Enter your backend URL
   - Local development: `http://localhost:8000`
   - Production: Your deployed backend URL

2. **API Token**: Paste the token you copied in step 2

3. Click **Save Configuration**

### 5. Add Folders to Sync

1. Click **Folders** in the sidebar
2. Click **Add Folder**
3. Click **Browse** and select a folder
4. Configure options:
   - ✅ **Include subfolders**: Recursively sync all subdirectories
   - ✅ **Ignore hidden files**: Skip files starting with `.`
   - **File Extensions**: Leave empty for all files, or specify: `.pdf, .docx, .txt`
   - **Max File Size**: Leave empty for no limit, or set in MB: `100`
   - **Groups**: Select which user groups can access these documents
5. Click **Save**

### 6. Run Your First Sync

1. Go to **Dashboard**
2. Click **Start Sync**
3. Watch the progress bar as files are:
   - Scanned
   - Checked for duplicates
   - Uploaded to Pinecone
   - Indexed for search

### 7. (Optional) Set Up Automatic Sync

1. Go to **Schedule**
2. ✅ Enable Automatic Sync
3. Choose frequency:
   - **Every Hour**: Syncs at the top of each hour
   - **Daily**: Choose a specific time (e.g., 2:00 AM)
   - **Weekly**: Choose day and time (e.g., Sunday at 3:00 AM)
4. Click **Save Schedule**

### 8. View Sync History

1. Go to **History**
2. See all past sync runs with details:
   - Files scanned, new, updated, deleted
   - Success/failure status
   - Duration and timestamp
   - Any error messages

## How Files Are Synced

1. **Scan**: The app scans your configured folders and computes a SHA-256 hash for each file
2. **Check**: It asks the backend "do you have files with these hashes?"
3. **Upload**: Only new or modified files are uploaded (deduplication via hash)
4. **Index**: Backend processes files and adds them to Pinecone vector database
5. **Delete**: Files removed locally are also removed from the backend
6. **Track**: Local database keeps track of what's synced for efficiency

## Permissions & Groups

When you assign groups to a folder:
- Only users in those groups can see/search documents from that folder
- Use this for department-specific documents or sensitive data
- If no groups are selected, all users can access the documents

## File Filters

**File Extensions**:
- Leave empty to sync all file types
- Specify to limit: `.pdf, .docx, .xlsx, .txt`
- Extensions are case-insensitive

**Max File Size**:
- Leave empty for no limit
- Set a limit to skip large files: `50` (MB)
- Useful for avoiding timeout issues

**Hidden Files**:
- Enabled by default
- Skips files starting with `.` (like `.DS_Store`)

## Troubleshooting

### "API not configured"
→ Go to Settings and enter your API URL and token

### "No folder configurations found"
→ Go to Folders and add at least one folder

### Files not syncing
1. Check that the folder configuration is **enabled** (green checkmark)
2. Verify files match the extension filter
3. Check file sizes don't exceed the limit
4. Look at History page for error messages

### "Failed to upload files"
1. Verify API URL is correct and backend is running
2. Check API token is still valid
3. Look at backend logs for errors
4. Ensure network connection is stable

## Tips

- Start with a small test folder to verify everything works
- Use file extension filters to avoid uploading unnecessary files
- Set max file size to prevent timeouts on large files
- Enable scheduling to keep everything up-to-date automatically
- Check History regularly to catch any sync issues early

## Support

For issues or questions:
1. Check the [README.md](README.md) for detailed documentation
2. Review error messages in the History page
3. Check backend logs for more details
4. Contact your system administrator

## Building for Production

To create a distributable package:

```bash
npm run build
npm run package
```

This will create installers in the `release/` folder for your platform.
