const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Socket } = require('dgram');


const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files (HTML, CSS, client-side JS) from the current directory
app.use(express.static(__dirname));

// Serve the HTML file from the root directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// In-memory store for T-account data
// We'll use an object where keys are account IDs, and values are the account objects.
let accountsData = {};
// In-memory store for transactions
let transactions = [];


io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send the current state of all accounts to the newly connected client
    // Object.values() converts the accountsData object into an array of its values (the account objects)
    socket.emit('initialAccounts', Object.values(accountsData));
    // Send existing transactions to the newly connected client
    socket.emit('initialTransactions', transactions);

    // Listen for a new account being added by a client
    socket.on('addAccount', (newAccountData) => {
        console.log('Received addAccount event with data:', newAccountData);
        if (newAccountData && newAccountData.id) {
            accountsData[newAccountData.id] = newAccountData;
            // Broadcast the new account to ALL clients (including the sender).
            // The client-side logic should handle this gracefully (e.g., not re-adding if already present).
            io.emit('newAccountAdded', newAccountData);
            console.log(`Account ${newAccountData.id} titled "${newAccountData.title}" added. Total accounts: ${Object.keys(accountsData).length}`);
        } else {
            console.warn('Received invalid new account data:', newAccountData);
        }
    });

    // Listen for T-account movement events from clients
    socket.on('boxMoved', (data) => { // Expected data: { id: string, x: number, y: number }
        // This can be very verbose if logged for every small movement.
        // console.log('Received boxMoved event with data:', data);
        if (data && data.id && accountsData[data.id]) {
            // Update the server's record of the specific account's position
            accountsData[data.id].x = data.x;
            accountsData[data.id].y = data.y;
            // Broadcast the updated position to all OTHER clients
            socket.broadcast.emit('boxPositionUpdate', data);
        } else {
            console.warn('Received boxMoved event for an unknown or invalid account ID:', data ? data.id : 'undefined data');
        }
    });

    // Listen for a client requesting to clear all accounts
    socket.on('clearAllAccounts', () => {
        console.log('Received clearAllAccounts event from client:', socket.id);
        accountsData = {}; // Clear the server's T-account data
        transactions = []; // Clear the server's transaction data
        io.emit('allAccountsCleared'); // Broadcast to all clients that accounts are cleared
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
            });
            accountsData = newAccountsData;
            // Broadcast the new layout to all clients (including the sender for consistency, or use socket.broadcast if preferred)
            io.emit('accountsArrangedUpdate', Object.values(accountsData));
            console.log('Accounts layout updated on server. Notified all clients.');
        } else {
            console.warn('Received invalid data for accountsArranged event:', arrangedLayoutData);
        }
    });

    // Listen for a client renaming an account
    socket.on('renameAccount', (data) => { // Expected data: { id: string, title: string }
        console.log('Received renameAccount event:', data);
        if (data && data.id && accountsData[data.id] && typeof data.title === 'string') {
            accountsData[data.id].title = data.title;
            // Broadcast the title change to all OTHER clients
            socket.broadcast.emit('accountTitleUpdate', { id: data.id, title: data.title });
            console.log(`Account ${data.id} renamed to "${data.title}". Notified other clients.`);
        } else {
            console.warn('Received invalid data for renameAccount event:', data);
        }
    });

    // Listen for a client deleting an account
    socket.on('deleteAccount', (accountId) => {
        console.log('Received deleteAccount event for ID:', accountId);
        if (accountId && accountsData[accountId]) {
            const deletedAccountTitle = accountsData[accountId].title;
            delete accountsData[accountId]; // Remove from server's data store
            // Broadcast the ID of the deleted account to ALL clients (including the sender for consistency, or use socket.broadcast)
            io.emit('accountDeleted', accountId);
            console.log(`Account "${deletedAccountTitle}" (ID: ${accountId}) deleted from server. Notified all clients. Total accounts: ${Object.keys(accountsData).length}`);
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
        for (const entry of transaction.entries) {
            if (!entry.accountId || !accountsData[entry.accountId] || !entry.type || typeof entry.amount !== 'number' || entry.amount <= 0) {
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
        transaction.entries.forEach(entry => {
            const account = accountsData[entry.accountId];
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
        transactions.push(transaction);

        // 4. Broadcast the processed transaction to all OTHER clients
        // The client that initiated the transaction already processed it locally.
        socket.broadcast.emit('transactionAdded', transaction);
        console.log(`Transaction ${transaction.id} processed and broadcasted. Affected accounts: ${Array.from(accountsToUpdate).join(', ')}`);
    });


    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Optional: Implement cleanup or notification if a user disconnects,
        // e.g., if accounts were tied to users, but for this scenario, it's likely not needed.
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});