import * as dom from './domElements.js';
import * as state from './state.js';
import { processTransaction } from './transactionActions.js';
import { socket } from './socketService.js';

function addEntryRowToModal(defaults = {}) {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'transaction-entry';
    const accountSelect = document.createElement('select');
    accountSelect.className = 'transaction-account';
    if (state.getAccounts().length === 0 && !defaults.accountId) {
        const option = document.createElement('option');
        option.textContent = "No accounts available"; option.disabled = true;
        accountSelect.appendChild(option);
    }
    state.getAccounts().forEach(acc => {
        const option = document.createElement('option');
        option.value = acc.id; option.textContent = acc.title;
        accountSelect.appendChild(option);
    });
    if (defaults.accountId) accountSelect.value = defaults.accountId;

    const typeSelect = document.createElement('select');
    typeSelect.className = 'transaction-type';
    ['Debit', 'Credit'].forEach(type => {
        const option = document.createElement('option');
        option.value = type.toLowerCase(); option.textContent = type;
        typeSelect.appendChild(option);
    });
    if (defaults.type) typeSelect.value = defaults.type;
    else typeSelect.value = 'credit'; // Default to Credit

    const amountInput = document.createElement('input');
    amountInput.type = 'number'; amountInput.className = 'transaction-amount';
    amountInput.placeholder = 'Amount'; amountInput.min = '0.01'; amountInput.step = '0.01';
    if (defaults.amount) amountInput.value = defaults.amount;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = function() { entryDiv.remove(); updateModalTotals(); };

    entryDiv.appendChild(accountSelect); entryDiv.appendChild(typeSelect);
    entryDiv.appendChild(amountInput); entryDiv.appendChild(removeBtn);
    dom.transactionEntriesContainer.appendChild(entryDiv);
    amountInput.oninput = updateModalTotals;
    typeSelect.onchange = updateModalTotals;
}

function updateModalTotals() {
    let totalDebits = 0, totalCredits = 0;
    document.querySelectorAll('.transaction-entry').forEach(row => {
        const type = row.querySelector('.transaction-type').value;
        const amount = parseFloat(row.querySelector('.transaction-amount').value) || 0;
        if (type === 'debit') totalDebits += amount;
        else if (type === 'credit') totalCredits += amount;
    });
    dom.modalTotalDebitsEl.textContent = totalDebits.toFixed(2);
    dom.modalTotalCreditsEl.textContent = totalCredits.toFixed(2);
}

export function initializeTransactionModal() {
    dom.openTransactionModalBtnEl.onclick = () => {
        dom.transactionModal.style.display = "block";
        dom.transactionDescriptionInput.value = "";
        dom.transactionEntriesContainer.innerHTML = '';
        addEntryRowToModal({ amount: 100 });
        addEntryRowToModal({ type: 'credit', amount: 100 });
        updateModalTotals();
    };
    dom.closeTransactionModalBtn.onclick = () => dom.transactionModal.style.display = "none";
    window.onclick = (event) => { if (event.target === dom.transactionModal) dom.transactionModal.style.display = "none"; };
    dom.addTransactionEntryRowBtn.onclick = () => addEntryRowToModal(); // Call without args for default behavior

    dom.saveTransactionBtn.onclick = () => {
        const description = dom.transactionDescriptionInput.value.trim();
        const entries = [];
        let totalDebits = 0, totalCredits = 0;
        document.querySelectorAll('.transaction-entry').forEach(row => {
            const accountId = row.querySelector('.transaction-account').value;
            const type = row.querySelector('.transaction-type').value;
            const amount = parseFloat(row.querySelector('.transaction-amount').value);
            if (!accountId || !type || isNaN(amount) || amount <= 0) return;
            entries.push({ accountId, type, amount });
            if (type === 'debit') totalDebits += amount; else totalCredits += amount;
        });
        if (entries.length < 2 || totalDebits !== totalCredits || totalDebits === 0) {
            alert("Invalid transaction. Ensure at least two entries, debits equal credits, and total is not zero."); return;
        }
        const transaction = { id: `txn-${Date.now()}`, description, entries };
        processTransaction(transaction);
        socket.emit('addTransaction', transaction);
        dom.transactionModal.style.display = "none";
    };
}