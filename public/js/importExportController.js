import * as dom from './domElements.js';
import * as state from './state.js';
import { socket } from './socketService.js';

function sanitizeFilename(name) {
    // Replace spaces with underscores and remove characters not allowed in filenames
    return name.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
}

export function initializeImportExport() {
    if (dom.exportBtnEl) {
        dom.exportBtnEl.addEventListener('click', () => {
            const currentSessionTitle = dom.sessionTitleElement ? dom.sessionTitleElement.textContent.trim() : "Untitled Session";
            const dataToExport = {
                sessionTitle: currentSessionTitle,
                accounts: state.getAccounts(),
                transactions: state.getTransactions()
            };
            const jsonString = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const filename = sanitizeFilename(currentSessionTitle || 't-collab-session') + '.json';
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
            console.log('Data exported with session title.');
        });
    } else {
        console.warn("Export button (exportBtnEl) not found. Export functionality will be unavailable.");
    }

    const importInput = document.createElement('input');
    importInput.type = 'file'; 
    importInput.id = 'importDataInput';
    importInput.accept = '.json'; importInput.style.display = 'none';

    if (dom.buttonContainer) {
        dom.buttonContainer.appendChild(importInput);
    } else {
        console.warn("Button container (buttonContainer) not found. Import input will not be added to the DOM.");
    }

    if (dom.importBtnEl) {
        dom.importBtnEl.addEventListener('click', () => {
            importInput.click();
        });

        importInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        // Validate accounts, transactions, and optionally sessionTitle
                        if (importedData &&
                            Array.isArray(importedData.accounts) &&
                            Array.isArray(importedData.transactions) &&
                            (typeof importedData.sessionTitle === 'string' || typeof importedData.sessionTitle === 'undefined')) {
                            socket.emit('stateImported', importedData); // Send the whole object
                            console.log('Data imported and sent to server for synchronization.');
                            // Manually update the title on the importing client if present
                            if (dom.sessionTitleElement && typeof importedData.sessionTitle === 'string') {
                                dom.sessionTitleElement.textContent = importedData.sessionTitle;
                            }
                        } else {
                            alert('Invalid file format. Expected JSON with "accounts" and "transactions" arrays, and optionally a "sessionTitle" string.');
                        }
                    } catch (error) {
                        alert('Error parsing JSON file: ' + error.message);
                    } finally {
                        importInput.value = ''; // Reset file input
                    }
                };
                reader.readAsText(file);
            }
        });
    } else {
        console.warn("Import button (importBtnEl) not found. Import functionality will be unavailable.");
    }
}