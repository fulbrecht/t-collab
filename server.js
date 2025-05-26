const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve the HTML file from the root directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// In-memory store for T-account data
// We'll use an object where keys are account IDs, and values are the account objects.
let accountsData = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send the current state of all accounts to the newly connected client
    // Object.values() converts the accountsData object into an array of its values (the account objects)
    socket.emit('initialAccounts', Object.values(accountsData));

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
        accountsData = {}; // Clear the server's account data
        io.emit('allAccountsCleared'); // Broadcast to all clients that accounts are cleared
        console.log('All accounts cleared on server. Notified all clients.');
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
    
    socket.on('addTransaction', (transaction) => {
        console.log('Received addTransaction:', transaction);
        // 1. Validate the transaction (e.g., ensure accounts exist, debits === credits)
        // 2. Update server-side accountsData:
        //    Iterate transaction.entries
        //    Find account in accountsData by entry.accountId
        //    Add to account.debits/credits and update account.totalDebits/totalCredits
        // 3. Store the transaction itself if needed (e.g., in the `transactions` array)
        // 4. Broadcast the processed transaction or the updated accounts to all clients
        //    Option A: Broadcast the transaction, clients apply it
        //    io.emit('transactionAdded', transaction); 
        //    Option B: Broadcast all updated accounts (simpler for client, more data)
        //    io.emit('accountsUpdated', Object.values(accountsData)); 
        //    For Option B, client would listen to 'accountsUpdated' and replace boxData.

        // For now, let's assume Option A for client-side 'transactionAdded' listener
        // The client-side processTransaction already updates the initiator.
        // So, broadcast to others.
        socket.broadcast.emit('transactionAdded', transaction); // Client needs to implement full processing for this
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
