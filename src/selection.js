const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Gets the currently selected text on macOS using AppleScript
 * This works system-wide by simulating Cmd+C, reading clipboard, then restoring it
 */
async function getSelectedText() {
  return new Promise(async (resolve) => {
    try {
      // Save current clipboard content first
      let savedClipboard = '';
      try {
        const { stdout } = await execAsync('pbpaste');
        savedClipboard = stdout || '';
      } catch (e) {
        savedClipboard = '';
      }

      // Use a more reliable AppleScript that ensures the copy happens
      // We use a longer delay and check if text was actually copied
      const copyScript = `
        tell application "System Events"
          keystroke "c" using command down
        end tell
        delay 0.2
      `;

      // Execute the copy command
      await execAsync(`osascript -e '${copyScript}'`);
      
      // Wait a bit longer for clipboard to update
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Get the copied text
      let selectedText = '';
      try {
        const { stdout } = await execAsync('pbpaste');
        selectedText = stdout || '';
      } catch (e) {
        selectedText = '';
      }
      
      // Restore original clipboard in the background (don't wait for it)
      if (savedClipboard) {
        // Use a safer method to restore clipboard
        const restoreScript = `
          set the clipboard to "${savedClipboard.replace(/"/g, '\\"').replace(/\\/g, '\\\\').replace(/\$/g, '\\$').replace(/`/g, '\\`').replace(/\n/g, '\\n')}"
        `;
        execAsync(`osascript -e '${restoreScript}'`).catch(() => {
          // Ignore restore errors - not critical
        });
      } else {
        // Clear clipboard if it was empty
        execAsync('osascript -e \'set the clipboard to ""\'').catch(() => {});
      }
      
      const trimmed = selectedText.trim();
      console.log('Selected text length:', trimmed.length);
      resolve(trimmed);
    } catch (error) {
      console.error('Error getting selected text:', error);
      resolve('');
    }
  });
}

module.exports = { getSelectedText };

