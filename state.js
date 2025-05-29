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
    transactions = newTransactions;
}

export function addTransaction(transaction) {
    if (!transactions.find(t => t.id === transaction.id)) {
        transactions.push(transaction);
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