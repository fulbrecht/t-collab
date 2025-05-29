import { socket } from './socketService.js';
import * as state from './state.js';
import { renderTAccounts } from './tAccountRenderer.js';
import { renderTransactionList } from './transactionRenderer.js';

export function processTransaction(transaction, emitToServer = true) {
    if (!state.findTransactionById(transaction.id)) {
        state.addTransaction(transaction);
    }
    transaction.entries.forEach(entry => {
        const account = state.findAccountById(entry.accountId);
        if (account) {
            const newEntry = {
                id: `entry-${Date.now()}-${Math.random()}`,
                transactionId: transaction.id,
                amount: entry.amount,
                description: transaction.description
            };
            if (entry.type === 'debit') {
                account.debits.push(newEntry);
                account.totalDebits += entry.amount;
            } else {
                account.credits.push(newEntry);
                account.totalCredits += entry.amount;
            }
        }
    });
    renderTAccounts();
    renderTransactionList();
}

export function reverseTransactionEffects(transactionId) {
    const transaction = state.findTransactionById(transactionId);
    if (!transaction) return;
    transaction.entries.forEach(entry => {
        const account = state.findAccountById(entry.accountId);
        if (account) {
            if (entry.type === 'debit') {
                account.debits = account.debits.filter(dEntry => dEntry.transactionId !== transactionId);
                account.totalDebits -= entry.amount;
            } else {
                account.credits = account.credits.filter(cEntry => cEntry.transactionId !== transactionId);
                account.totalCredits -= entry.amount;
            }
        }
    });
}

export function handleDeleteTransaction(transactionId, transactionDescription) {
    reverseTransactionEffects(transactionId);
    state.removeTransactionById(transactionId);
    renderTransactionList();
    renderTAccounts();
    socket.emit('deleteTransaction', transactionId);
    console.log(`Transaction ${transactionId} deleted locally and request sent to server.`);
}

export function handleEditTransactionDescriptionInPlace(transactionData, listItemElement) {
    const currentDescription = transactionData.description || `Transaction ${transactionData.id}`;
    if (listItemElement.querySelector('input.transaction-description-edit-input')) return;

    const deleteButtonHTML = listItemElement.querySelector('.transaction-delete-btn')?.outerHTML || '';
    listItemElement.innerHTML = '';

    const input = document.createElement('input');
    input.type = 'text'; input.value = currentDescription; input.className = 'transaction-description-edit-input';
    input.style.width = 'calc(100% - 10px)'; input.style.boxSizing = 'border-box';
    listItemElement.appendChild(input);
    input.focus(); input.select();

    const saveChanges = () => {
        const newDescription = input.value.trim();
        listItemElement.innerHTML = '';
        if (newDescription !== currentDescription && newDescription !== "") {
            transactionData.description = newDescription;
            socket.emit('editTransactionDescription', { transactionId: transactionData.id, newDescription });
        }
        renderTransactionList(); // Always re-render to restore or update
    };
    input.addEventListener('blur', saveChanges);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') input.blur(); });
}