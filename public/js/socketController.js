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
        // Re-render T-Accounts now that transactions are loaded, ensuring correct entry positioning
        renderTAccounts();
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
        // state.addTransaction will handle the isActive property.
        // processTransaction might need to be aware of isActive or be simplified if
        // server now sends fully updated accounts via 'initialAccounts' after this.
        // For now, let's assume state.addTransaction and re-rendering is the primary path.
        state.addTransaction(transaction);
        renderTransactionList();
        // If T-account balances are not updated by a subsequent 'initialAccounts' from server,
        // you might need to call processTransaction(transaction, false); here as well.
        // However, the server logic now recalculates and sends 'initialAccounts' after 'addTransaction'.
    });

    socket.on('transactionDeleted', (transactionId) => {
        // reverseTransactionEffects might need adjustment if server sends full 'initialAccounts'
        state.removeTransactionById(transactionId);
        renderTransactionList();
        // renderTAccounts(); // This will be handled by 'initialAccounts' from server
    });

    socket.on('transactionDescriptionUpdated', (data) => {
        const transaction = state.findTransactionById(data.transactionId);
        if (transaction) { transaction.description = data.newDescription; renderTransactionList(); }
    });

    socket.on('transactionActivityUpdated', ({ transactionId, isActive }) => {
        console.log(`Received transactionActivityUpdated: ${transactionId}, isActive: ${isActive}`);
        state.updateTransactionActiveState(transactionId, isActive);
        renderTransactionList(); // Re-render the list to show the toggle state and style
        // T-accounts will be updated by the 'initialAccounts' event that server sends
        // after recalculating balances due to the activity toggle.
    });

    socket.on('highlightTransaction', (data) => highlightTransactionEntries(data.transactionId, data.shouldHighlight, 'remote'));
    socket.on('unhighlightTransaction', (data) => highlightTransactionEntries(data.transactionId, false, 'remote'));
    socket.on('userCountUpdate', (count) => { if (userCountText) userCountText.text(`Users: ${count}`); });



}
