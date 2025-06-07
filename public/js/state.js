export let boxData = [];
export let transactions = [];
export let sessionTitle = "";

export function setSessionTitle(newTitle) {
    sessionTitle = newTitle;
}


export function setBoxData(newData) {
    boxData = newData;
}

export function setTransactions(newTransactions) {
    // Ensure all transactions have an isActive property, defaulting to true if not present
    transactions = Array.isArray(newTransactions) ? newTransactions.map(txn => ({
        ...txn,
        isActive: txn.isActive === undefined ? true : txn.isActive
    })) : [];
}

export function addTransaction(transaction) {
    if (!transactions.find(t => t.id === transaction.id)) {
        // Ensure the new transaction has an isActive property, defaulting to true
        transactions.push({
            ...transaction,
            isActive: transaction.isActive === undefined ? true : transaction.isActive
        });
    }
}

export function removeTransactionById(transactionId) {
    const index = transactions.findIndex(txn => txn.id === transactionId);
    if (index > -1) {
        transactions.splice(index, 1);
    }
}

export function findTransactionById(transactionId) {
    return transactions.find(txn => txn.id === transactionId);
}

export function findAccountById(accountId) {
    return boxData.find(acc => acc.id === accountId);
}

export function getAccounts() { return boxData; }
export function getTransactions() { return transactions; }
export function getTitle() { return sessionTitle; }

export function updateTransactionActiveState(transactionId, isActive) {
    const transaction = transactions.find(txn => txn.id === transactionId);
    if (transaction) {
        transaction.isActive = isActive;
    } else {
        console.warn(`Transaction with ID ${transactionId} not found in local state for active state update.`);
    }
}