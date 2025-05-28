import * as dom from './domElements.js';
import { initializeTransactionModal } from './transactionModalController.js';
import { initializeImportExport } from './importExportController.js';
import { initializeSocketHandlers } from './socketController.js';
import { addNewTAccount, clearAllData, arrangeTAccounts } from './tAccountActions.js';
// Note: svgService.js, config.js, state.js, dragController.js, tAccountRenderer.js, transactionRenderer.js, transactionActions.js
// are used by the imported modules, so they don't need to be explicitly imported here unless app.js directly uses their exports.

// --- Initialize Application ---

// Initialize Socket.IO event handlers
initializeSocketHandlers();

// Initialize UI components that require JavaScript interaction
initializeTransactionModal();
initializeImportExport();

// --- Attach Main UI Event Listeners ---
dom.addAccountBtnEl.addEventListener('click', addNewTAccount);
dom.clearAllBtnEl.addEventListener('click', clearAllData);
dom.arrangeAccountsBtnEl.addEventListener('click', arrangeTAccounts);

console.log("T-Collab application initialized.");