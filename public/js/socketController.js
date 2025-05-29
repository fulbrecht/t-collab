import { socket } from './socketService.js';
import * as state from './state.js';
import { svg, userCountText } from './svgService.js';
import { renderTAccounts } from './tAccountRenderer.js';
import { renderTransactionList, highlightTransactionEntries } from './transactionRenderer.js';
import { processTransaction, reverseTransactionEffects } from './transactionActions.js';
import { sessionTitleElement } from './domElements.js';

export function initializeSocketHandlers() {

    socket.on('initialSessionTitle', (serverTitle) => {
        console.log('Received initial title:', serverTitle);
        state.setSessionTitle(serverTitle);
        if (document.activeElement !== sessionTitleElement) {
            sessionTitleElement.textContent = serverTitle;
        } else {
            console.log("Session title updated by another user, but current user is editing. Local changes preserved for now.");
        }
    });

    socket.on('initialAccounts', (serverAccounts) => {
        console.log('Received initial accounts:', serverAccounts);
        state.setBoxData(serverAccounts);
        renderTAccounts();
    });

    socket.on('initialTransactions', (serverTransactions) => {
        console.log('Received initial transactions:', serverTransactions);
        state.setTransactions(serverTransactions);
        renderTransactionList();
    });

    socket.on('newAccountAdded', (accountData) => {
        console.log('Received new account from server:', accountData);
        const existingAccount = state.findAccountById(accountData.id);
        if (!existingAccount) {
            state.boxData.push(accountData); // Or use state.addAccount
        } else {
            Object.assign(existingAccount, accountData);
        }
        renderTAccounts();
    });

    socket.on('boxPositionUpdate', (data) => {
        const accountToUpdate = state.findAccountById(data.id);
        if (accountToUpdate) {
            accountToUpdate.x = data.x; accountToUpdate.y = data.y;
            svg.selectAll(".draggable-group").filter(d => d.id === data.id)
               .attr("transform", `translate(${data.x}, ${data.y})`);
        }
    });

    socket.on('allAccountsCleared', () => {
        state.setBoxData([]); state.setTransactions([]);
        renderTAccounts(); renderTransactionList();
    });

    socket.on('accountsArrangedUpdate', (arrangedData) => {
        if (Array.isArray(arrangedData)) {
            state.setBoxData(arrangedData); renderTAccounts();
        }
    });

    socket.on('accountTitleUpdate', (data) => {
        const accountToUpdate = state.findAccountById(data.id);
        if (accountToUpdate) {
            accountToUpdate.title = data.title;
            svg.selectAll(".draggable-group").filter(d_svg => d_svg.id === data.id)
               .select(".t-account-title-text").text(data.title);
        }
    });

    socket.on('accountDeleted', (accountId) => {
        state.setBoxData(state.getAccounts().filter(acc => acc.id !== accountId));
        renderTAccounts();
    });

    socket.on('transactionAdded', (transaction) => {
        processTransaction(transaction, false);
    });

    socket.on('transactionDeleted', (transactionId) => {
        reverseTransactionEffects(transactionId);
        state.removeTransactionById(transactionId);
        renderTransactionList(); renderTAccounts();
    });

    socket.on('transactionDescriptionUpdated', (data) => {
        const transaction = state.findTransactionById(data.transactionId);
        if (transaction) { transaction.description = data.newDescription; renderTransactionList(); }
    });

    socket.on('highlightTransaction', (data) => highlightTransactionEntries(data.transactionId, data.shouldHighlight, 'remote'));
    socket.on('unhighlightTransaction', (data) => highlightTransactionEntries(data.transactionId, false, 'remote'));
    socket.on('userCountUpdate', (count) => { if (userCountText) userCountText.text(`Users: ${count}`); });



}


