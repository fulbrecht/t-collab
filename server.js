const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Socket } = require('dgram');


// In-memory store for all session data
// Structure: { sessionId: { accountsData: { accountId: {...} }, transactions: [...], connectedUsers: N } }
let sessions = {};

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const DEFAULT_SESSION_ID = 'default'; // A default session if none is provided
const PORT = process.env.PORT || 3000;

// Serve static files (HTML, CSS, client-side JS) from the current directory
app.use(express.static(__dirname));

// Serve the HTML file from the root directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// In-memory store for T-account data
let connectedUsers = 0; // Global counter for all connected users

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Determine the session ID from query parameters or use default
    const sessionId = socket.handshake.query.sessionId || DEFAULT_SESSION_ID;
    console.log(`User ${socket.id} connecting to session: ${sessionId}`);

    // Join the socket to the session room
    socket.join(sessionId);

    // Initialize session state if it doesn't exist
    if (!sessions[sessionId]) {
        sessions[sessionId] = {
            accountsData: {},
            transactions: [],
            connectedUsers: 0,
        };
        console.log(`Initialized new session: ${sessionId}`);
    }

    const session = sessions[sessionId];

    // Send the current state of all accounts to the newly connected client
    socket.emit('initialAccounts', Object.values(session.accountsData));
    // Send existing transactions to the newly connected client
    socket.emit('initialTransactions', session.transactions);

    // Increment global and session-specific user counts
    connectedUsers++;
    session.connectedUsers++;
    io.emit('userCountUpdate', connectedUsers); // Broadcast new count to all
    console.log(`Global user count: ${connectedUsers}, Session ${sessionId} user count: ${session.connectedUsers}`);

    // Listen for a new account being added by a client
    socket.on('addAccount', (newAccountData) => {
        console.log('Received addAccount event with data:', newAccountData);
        if (newAccountData && newAccountData.id) {
            session.accountsData[newAccountData.id] = newAccountData;
            // Broadcast the new account to ALL clients IN THIS SESSION.
            io.to(sessionId).emit('newAccountAdded', newAccountData);
            console.log(`Account ${newAccountData.id} titled "${newAccountData.title}" added to session ${sessionId}. Total accounts in session: ${Object.keys(session.accountsData).length}`);
        } else {
            console.warn('Received invalid new account data:', newAccountData);
        }
    });

    // Listen for T-account movement events from clients
    socket.on('boxMoved', (data) => { // Expected data: { id: string, x: number, y: number }
        // This can be very verbose if logged for every small movement.
        // console.log('Received boxMoved event with data:', data);
        if (data && data.id && session.accountsData[data.id]) {
            // Update the server's record of the specific account's position
            session.accountsData[data.id].x = data.x;
            session.accountsData[data.id].y = data.y;
            // Broadcast the updated position to all OTHER clients IN THIS SESSION
            socket.broadcast.to(sessionId).emit('boxPositionUpdate', data);
        } else {
            console.warn('Received boxMoved event for an unknown or invalid account ID:', data ? data.id : 'undefined data');
        }
    });

    // Listen for a client requesting to clear all accounts
    socket.on('clearAllAccounts', () => {
        console.log('Received clearAllAccounts event from client:', socket.id);
        session.accountsData = {}; // Clear the session's T-account data
        session.transactions = []; // Clear the session's transaction data
        io.to(sessionId).emit('allAccountsCleared'); // Broadcast to all clients IN THIS SESSION
        console.log('All T-accounts and transactions cleared on server. Notified all clients.');
    });

    // Listen for a client sending an arranged layout of accounts
    socket.on('accountsArranged', (arrangedLayoutData) => {
        console.log('Received accountsArranged event from client:', socket.id);
        if (Array.isArray(arrangedLayoutData)) {
            // Rebuild accountsData from the received layout
            const newAccountsData = {};
            arrangedLayoutData.forEach(account => {
                if (account && account.id) {
                    newAccountsData[account.id] = account;
                }
            }); // This rebuilds the accountsData object for the session
            session.accountsData = newAccountsData;
            // Broadcast the new layout to all clients IN THIS SESSION
            io.to(sessionId).emit('accountsArrangedUpdate', Object.values(session.accountsData));
            console.log('Accounts layout updated on server. Notified all clients.');
        } else {
            console.warn('Received invalid data for accountsArranged event:', arrangedLayoutData);
        }
    });

    // Listen for a client renaming an account
    socket.on('renameAccount', (data) => { // Expected data: { id: string, title: string }
        console.log('Received renameAccount event:', data);
        if (data && data.id && session.accountsData[data.id] && typeof data.title === 'string') {
            session.accountsData[data.id].title = data.title;
            // Broadcast the title change to all OTHER clients IN THIS SESSION
            socket.broadcast.to(sessionId).emit('accountTitleUpdate', { id: data.id, title: data.title });
            console.log(`Account ${data.id} renamed to "${data.title}". Notified other clients.`);
        } else {
            console.warn('Received invalid data for renameAccount event:', data);
        }
    });

    // Listen for a client deleting an account
    socket.on('deleteAccount', (accountId) => {
        console.log('Received deleteAccount event for ID:', accountId);
        if (accountId && session.accountsData[accountId]) {
            const deletedAccountTitle = session.accountsData[accountId].title;
            delete session.accountsData[accountId]; // Remove from session's data store
            // Broadcast the ID of the deleted account to ALL clients IN THIS SESSION
            io.to(sessionId).emit('accountDeleted', accountId);
            console.log(`Account "${deletedAccountTitle}" (ID: ${accountId}) deleted from session ${sessionId}. Notified all clients. Total accounts: ${Object.keys(session.accountsData).length}`);
        } else {
            console.warn('Received deleteAccount event for an unknown or invalid account ID:', accountId);
        }
    });

    socket.on('addTransaction', (transaction) => {
        console.log('Received addTransaction:', transaction);
        if (!transaction || !transaction.id || !Array.isArray(transaction.entries) || transaction.entries.length < 2) {
            console.warn('Invalid transaction data received:', transaction);
            // Optionally, send an error back to the client
            // socket.emit('transactionError', { message: 'Invalid transaction data.' });
            return;
        }

        let totalDebits = 0;
        let totalCredits = 0;
        let accountsToUpdate = new Set(); // To track which accounts are affected

        // 1. Validate transaction entries and calculate totals
        for (const entry of transaction.entries) { // Validation should use the session's accountsData
            if (!entry.accountId || !session.accountsData[entry.accountId] || !entry.type || typeof entry.amount !== 'number' || entry.amount <= 0) {
                console.warn('Invalid transaction entry:', entry);
                // socket.emit('transactionError', { message: `Invalid entry for account ${entry.accountId || 'unknown'}.` });
                return;
            }
            if (entry.type === 'debit') {
                totalDebits += entry.amount;
            } else if (entry.type === 'credit') {
                totalCredits += entry.amount;
            } else {
                console.warn('Invalid entry type:', entry.type);
                // socket.emit('transactionError', { message: `Invalid entry type ${entry.type}.` });
                return;
            }
            accountsToUpdate.add(entry.accountId);
        }

        if (totalDebits !== totalCredits || totalDebits === 0) {
            console.warn(`Transaction imbalance or zero total: Debits ${totalDebits}, Credits ${totalCredits}`);
            // socket.emit('transactionError', { message: 'Transaction debits must equal credits and not be zero.' });
            return;
        }

        // 2. Update server-side accountsData
        transaction.entries.forEach(entry => { // Update uses the session's accountsData
            const account = session.accountsData[entry.accountId];
            const newServerEntry = { id: `s_entry-${Date.now()}-${Math.random()}`, transactionId: transaction.id, amount: entry.amount, description: transaction.description };
            if (entry.type === 'debit') {
                account.debits.push(newServerEntry);
                account.totalDebits += entry.amount;
            } else { // credit
                account.credits.push(newServerEntry);
                account.totalCredits += entry.amount;
            }
        });

        // 3. Store the transaction itself
        session.transactions.push(transaction);

        // 4. Broadcast the processed transaction to all OTHER clients
        // The client that initiated the transaction already processed it locally. Broadcast to others in the same session.
        socket.broadcast.to(sessionId).emit('transactionAdded', transaction);
        console.log(`Transaction ${transaction.id} processed for session ${sessionId} and broadcasted. Affected accounts: ${Array.from(accountsToUpdate).join(', ')}`);
    });

    // Listen for a client deleting a transaction
    socket.on('deleteTransaction', (transactionId) => {
        console.log('Received deleteTransaction event for ID:', transactionId);

        const transactionIndex = session.transactions.findIndex(txn => txn.id === transactionId);
        if (transactionIndex === -1) {
            console.warn(`Transaction with ID ${transactionId} not found on server.`);
            return;
        }

        const transactionToDelete = session.transactions[transactionIndex];

        // Reverse the effects of the transaction on accountsData
        transactionToDelete.entries.forEach(entry => {
            const account = session.accountsData[entry.accountId]; // Use session's accountsData
            if (account) {
                if (entry.type === 'debit') {
                    account.debits = account.debits.filter(dEntry => dEntry.transactionId !== transactionId);
                    account.totalDebits -= entry.amount;
                } else { // credit
                    account.credits = account.credits.filter(cEntry => cEntry.transactionId !== transactionId);
                    account.totalCredits -= entry.amount;
                }
            }
        });

        session.transactions.splice(transactionIndex, 1); // Remove from session's transactions array
        io.to(sessionId).emit('transactionDeleted', transactionId); // Broadcast to all clients IN THIS SESSION
        console.log(`Transaction ${transactionId} deleted from session ${sessionId}. Notified all clients.`);
    });

    // Listen for a client editing a transaction's description
    socket.on('editTransactionDescription', (data) => { // Expected data: { transactionId, newDescription }
        console.log('Received editTransactionDescription event:', data);
        if (data && data.transactionId && typeof data.newDescription === 'string') {
            const transaction = session.transactions.find(txn => txn.id === data.transactionId);
            if (transaction) {
                transaction.description = data.newDescription;
                // Broadcast the updated description to all OTHER clients IN THIS SESSION
                socket.broadcast.to(sessionId).emit('transactionDescriptionUpdated', { transactionId: data.transactionId, newDescription: data.newDescription });
                console.log(`Transaction ${data.transactionId} description updated to "${data.newDescription}". Notified other clients.`);
            } else {
                console.warn(`Transaction with ID ${data.transactionId} not found on server for description update.`);
            }
        } else {
            console.warn('Invalid data received for editTransactionDescription event:', data);
        }
    });

    // Listen for a client starting to highlight a transaction
    socket.on('startHighlightTransaction', (data) => { // Expected data: { transactionId }
        // console.log('Received startHighlightTransaction for ID:', data.transactionId);
        // Broadcast to all OTHER clients IN THIS SESSION to highlight this transaction
        socket.broadcast.to(sessionId).emit('highlightTransaction', { transactionId: data.transactionId, shouldHighlight: true });
    });

    // Listen for a client ending highlighting a transaction
    socket.on('endHighlightTransaction', (data) => { // Expected data: { transactionId }
        // console.log('Received endHighlightTransaction for ID:', data.transactionId);
        // Broadcast to all OTHER clients IN THIS SESSION to unhighlight this transaction
        socket.broadcast.to(sessionId).emit('unhighlightTransaction', { transactionId: data.transactionId, shouldHighlight: false });
    });

    // Listen for a client importing a new state
    socket.on('stateImported', (importedData) => {
        console.log('Received stateImported event from client:', socket.id);
        if (importedData && Array.isArray(importedData.accounts) && Array.isArray(importedData.transactions)) {
            // Replace server's state
            // This replaces the state for the session the importing client is in
            const newAccountsData = {};
            importedData.accounts.forEach(account => {
                if (account && account.id) {
                    newAccountsData[account.id] = account;
                }
            });
            session.accountsData = newAccountsData;
            session.transactions = importedData.transactions;

            // Broadcast the new complete state to ALL clients IN THIS SESSION
            io.to(sessionId).emit('initialAccounts', Object.values(session.accountsData)); // Send updated accounts
            io.to(sessionId).emit('initialTransactions', session.transactions); // Send updated transactions
            // Optionally, could also send userCountUpdate if that's part of the state, though it's managed live.
            console.log(`Session ${sessionId} state updated from import. Broadcasted to all clients in session.`);
        } else {
            console.warn(`Received invalid data for stateImported event from client ${socket.id} for session ${sessionId}:`, importedData);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        connectedUsers--; // Decrement global count
        io.emit('userCountUpdate', connectedUsers); // Broadcast new global count to all
        console.log(`Global user count: ${connectedUsers}`);

        // Decrement session user count and potentially clean up session if empty
        // The session ID was stored when the socket connected. We should retrieve it.
        // A simple way is to re-evaluate, but ideally, it's stored on the socket object.
        const userSessionId = socket.handshake.query.sessionId || DEFAULT_SESSION_ID; 
        if (userSessionId && sessions[userSessionId]) {
            sessions[userSessionId].connectedUsers--;
            console.log(`User disconnected from session ${userSessionId}. Users remaining in session: ${sessions[userSessionId].connectedUsers}`);            if (sessions[userSessionId].connectedUsers <= 0) {
                // Optional: Clean up session data if no users are connected
                // delete sessions[userSessionId];
                // console.log(`Session ${userSessionId} is now empty.`);
            }
        }
    });
});


// Start the server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = { app, server, io, sessions, DEFAULT_SESSION_ID }; // Export for testing