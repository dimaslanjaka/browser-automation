/**
 * Copies a string to the clipboard.
 *
 * Must be called from within an event handler such as a click.
 * Returns a Promise that resolves to true if the copy was successful, or false otherwise.
 *
 * Browser support: Chrome 43+, Firefox 42+, Safari 10+, Edge, and Internet Explorer 10+.
 * In Internet Explorer, the clipboard feature may be disabled by an administrator.
 * If the clipboard API fails, a prompt will be shown to the user as a fallback.
 *
 * @param {string} text - The text to copy to the clipboard.
 * @returns {Promise<boolean>|boolean|undefined} Resolves to true if successful, false otherwise. May return undefined in some fallback cases.
 */
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    // Modern asynchronous clipboard API
    return navigator.clipboard.writeText(text).catch((err) => {
      console.warn('Copy to clipboard failed.', err);
      // Fallback to prompt if clipboard API fails
      return prompt('Copy to clipboard: Ctrl+C, Enter', text);
    });
  } else if (window.clipboardData && window.clipboardData.setData) {
    // Internet Explorer-specific code path to prevent textarea being shown while dialog is visible.
    return window.clipboardData.setData('Text', text);
  } else if (document.queryCommandSupported && document.queryCommandSupported('copy')) {
    var textarea = document.createElement('textarea');
    textarea.textContent = text;
    textarea.style.position = 'fixed'; // Prevent scrolling to bottom of page in Microsoft Edge.
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand('copy'); // Security exception may be thrown by some browsers.
    } catch (ex) {
      console.warn('Copy to clipboard failed.', ex);
      return prompt('Copy to clipboard: Ctrl+C, Enter', text);
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

export { copyToClipboard };
export default copyToClipboard;
