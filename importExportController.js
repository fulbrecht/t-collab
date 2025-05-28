import * as dom from './domElements.js';
import * as state from './state.js';
import { socket } from './socketService.js';

export function initializeImportExport() {
    dom.exportBtnEl.addEventListener('click', () => {
        const dataToExport = { accounts: state.getAccounts(), transactions: state.getTransactions() };
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 't-collab-data.json';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        console.log('Data exported.');
    });

    const importInput = document.createElement('input');
    importInput.type = 'file'; 
    importInput.id = 'importDataInput';
    importInput.accept = '.json'; importInput.style.display = 'none';

    dom.buttonContainer.appendChild(importInput);

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
                    if (importedData && Array.isArray(importedData.accounts) && Array.isArray(importedData.transactions)) {
                        socket.emit('stateImported', importedData);
                        console.log('Data imported and sent to server for synchronization.');
                    } else {
                        alert('Invalid file format. Expected JSON with "accounts" and "transactions" arrays.');
                    }
                } catch (error) {
                    alert('Error parsing JSON file: ' + error.message);
                } finally {
                    importInput.value = '';
                }
            };
            reader.readAsText(file);
        }
    });
}