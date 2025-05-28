import * as dom from './domElements.js';
import * as state from './state.js';
import { socket } from './socketService.js';

export function initializeImportExport() {
    const exportBtn = document.createElement('button');
    exportBtn.id = 'exportDataBtn';
    exportBtn.textContent = 'Export Data';
    dom.buttonContainer.appendChild(exportBtn);

    exportBtn.addEventListener('click', () => {
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

    const importLabel = document.createElement('label');
    importLabel.htmlFor = 'importDataInput';
    importLabel.textContent = 'Import Data';
    importLabel.style.padding = '6px 12px'; importLabel.style.border = '1px solid #ccc';
    importLabel.style.borderRadius = '4px'; importLabel.style.backgroundColor = '#f0f0f0';
    importLabel.style.cursor = 'pointer'; importLabel.style.marginLeft = '5px';

    const importInput = document.createElement('input');
    importInput.type = 'file'; importInput.id = 'importDataInput';
    importInput.accept = '.json'; importInput.style.display = 'none';

    dom.buttonContainer.appendChild(importLabel);
    dom.buttonContainer.appendChild(importInput);

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