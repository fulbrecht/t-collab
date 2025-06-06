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
    else typeSelect.value = 'debit'; // Default to Debit

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
        // Ensure the "allow unbalanced" checkbox is unchecked by default
        const allowUnbalancedCheckbox = document.getElementById('allowUnbalancedTxn');
        if (allowUnbalancedCheckbox) allowUnbalancedCheckbox.checked = false;

        updateModalTotals();
    };
    dom.closeTransactionModalBtn.onclick = () => dom.transactionModal.style.display = "none";
    window.onclick = (event) => { if (event.target === dom.transactionModal) dom.transactionModal.style.display = "none"; };
    dom.addTransactionEntryRowBtn.onclick = () => addEntryRowToModal(); // Call without args for default behavior

    // Add checkbox for allowing unbalanced transactions
    const unbalancedContainer = document.createElement('div');
    unbalancedContainer.style.display = 'flex'; // Align items horizontally
    unbalancedContainer.style.alignItems = 'center'; // Vertically center items in the flex container
    unbalancedContainer.style.marginTop = '10px'; // Add some space above

    const allowUnbalancedCheckbox = document.createElement('input');
    allowUnbalancedCheckbox.type = 'checkbox';
    allowUnbalancedCheckbox.id = 'allowUnbalancedTxn';
    allowUnbalancedCheckbox.style.marginRight = '5px'; // Space between checkbox and label

    const unbalancedLabel = document.createElement('label');
    unbalancedLabel.htmlFor = 'allowUnbalancedTxn';
    unbalancedLabel.textContent = ' Allow unbalanced transaction (e.g., for opening balances)';

    unbalancedContainer.appendChild(allowUnbalancedCheckbox);
    unbalancedContainer.appendChild(unbalancedLabel);

    if (dom.transactionForm && dom.saveTransactionBtn) {
        dom.transactionForm.insertBefore(unbalancedContainer, dom.saveTransactionBtn);
    } else {
        console.error("Transaction form or save button not found in DOM. Cannot add 'allow unbalanced' checkbox.");
    }
    
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

        // Client-side validation for unique accounts in debits and credits
        const debitEntries = entries.filter(entry => entry.type === 'debit');
        const creditEntries = entries.filter(entry => entry.type === 'credit');

        const debitAccountIds = new Set();
        for (const entry of debitEntries) {
            if (debitAccountIds.has(entry.accountId)) {
                alert("Duplicate account found in debits. Each account can only be debited once per transaction.");
                return;
            }
            debitAccountIds.add(entry.accountId);
        }

        const creditAccountIds = new Set();
        for (const entry of creditEntries) {
            if (creditAccountIds.has(entry.accountId)) {
                alert("Duplicate account found in credits. Each account can only be credited once per transaction.");
                return;
            }
            creditAccountIds.add(entry.accountId);
        }

        const isUnbalancedAllowed = document.getElementById('allowUnbalancedTxn').checked;
        if (!isUnbalancedAllowed && (entries.length < 2 || totalDebits !== totalCredits || totalDebits === 0)) {
            alert("Invalid transaction. Ensure at least two entries, debits equal credits, and total is not zero. Or, check 'Allow unbalanced transaction'."); return;
        }
        const transaction = { id: `txn-${Date.now()}`, description, entries, isUnbalancedAllowed }; // Add isUnbalancedAllowed flag
        processTransaction(transaction);
        socket.emit('addTransaction', transaction);
        dom.transactionModal.style.display = "none";
    };
}