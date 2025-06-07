const Client = require("socket.io-client");
const { server: actualHttpServer, io: actualIo, accountsData: actualServerAccountsData, transactions: actualServerTransactions } = require('./server');

describe("T-Collab Server Integration Tests", () => {
    let clientSocket;
    let httpServerInstance;
    let port;

    beforeAll((done) => {
        httpServerInstance = actualHttpServer.listen(0, () => { // Listen on port 0 for a random available port
            port = httpServerInstance.address().port;
            done();
        });
    });

    afterAll(() => {
        actualIo.close();
        httpServerInstance.close();
    });

    beforeEach((done) => {
        // Reset server's in-memory state
        Object.keys(actualServerAccountsData).forEach(key => delete actualServerAccountsData[key]);
        actualServerTransactions.length = 0;
        // Note: connectedUsers count is managed by the server on connect/disconnect.
        // For tests relying on a specific count from zero, ensure clients are disconnected.

        // Connect a new client for each test to ensure a clean state for listeners
        clientSocket = new Client(`http://localhost:${port}`);
        clientSocket.on("connect", done);
    });

    afterEach(() => {
        // Disconnect the client after each test
        if (clientSocket.connected) {
            clientSocket.disconnect();
        }
    });

    test("should connect a user, send initial data, and update user count", (done) => {
        let initialAccountsReceived = false;
        let initialTransactionsReceived = false;
        let userCountCorrect = false;

        clientSocket.on('initialAccounts', (accounts) => {
            expect(accounts).toEqual([]); // Expect empty initially
            initialAccountsReceived = true;
            if (initialTransactionsReceived && userCountCorrect) done();
        });

        clientSocket.on('initialTransactions', (transactions) => {
            expect(transactions).toEqual([]); // Expect empty initially
            initialTransactionsReceived = true;
            if (initialAccountsReceived && userCountCorrect) done();
        });

        clientSocket.on('userCountUpdate', (count) => {
            // This might receive updates from previous tests if clients weren't disconnected properly.
            // The first update for *this* client's connection should make the count at least 1.
            if (count >= 1) { // Check if count is at least 1 due to this client
                userCountCorrect = true;
                if (initialAccountsReceived && initialTransactionsReceived) done();
            }
        });
    });

    test("should handle 'addAccount' and broadcast 'newAccountAdded'", (done) => {
        const newAccount = { id: 'accTest1', title: 'Test Account 1', x: 10, y: 20, debits: [], credits: [], totalDebits: 0, totalCredits: 0 };

        clientSocket.on('newAccountAdded', (accountData) => {
            expect(accountData).toEqual(newAccount);
            expect(actualServerAccountsData[newAccount.id]).toEqual(newAccount);
            done();
        });

        clientSocket.emit('addAccount', newAccount);
    });

    test("should handle 'clearAllAccounts' and broadcast 'allAccountsCleared'", (done) => {
        // Setup: Add some data to be cleared
        actualServerAccountsData['accToClear'] = { id: 'accToClear', title: 'To Be Cleared' };
        actualServerTransactions.push({ id: 'txnToClear', description: 'To Be Cleared Txn' });

        clientSocket.on('allAccountsCleared', () => {
            expect(Object.keys(actualServerAccountsData).length).toBe(0);
            expect(actualServerTransactions.length).toBe(0);
            done();
        });

        clientSocket.emit('clearAllAccounts');
    });

    test("should handle 'boxMoved' and broadcast 'boxPositionUpdate' to other clients", (done) => {
        const accountToMove = { id: 'accMove', title: 'Movable Account', x: 0, y: 0, debits: [], credits: [], totalDebits: 0, totalCredits: 0 };
        actualServerAccountsData[accountToMove.id] = { ...accountToMove }; // Add to server state

        const newPosition = { id: 'accMove', x: 100, y: 150 };

        // Create a second client to listen for the broadcast
        const clientSocket2 = new Client(`http://localhost:${port}`);
        clientSocket2.on('connect', () => {
            clientSocket2.on('boxPositionUpdate', (updatedPosition) => {
                expect(updatedPosition).toEqual(newPosition);
                expect(actualServerAccountsData[accountToMove.id].x).toBe(newPosition.x);
                expect(actualServerAccountsData[accountToMove.id].y).toBe(newPosition.y);
                clientSocket2.disconnect();
                done();
            });

            // Client 1 emits the move event
            clientSocket.emit('boxMoved', newPosition);
        });
    });

    test("should handle 'addTransaction', update server state, and broadcast 'transactionAdded'", (done) => {
        const account1 = { id: 'accTxn1', title: 'Txn Acc 1', x: 0, y: 0, debits: [], credits: [], totalDebits: 0, totalCredits: 0 };
        const account2 = { id: 'accTxn2', title: 'Txn Acc 2', x: 0, y: 0, debits: [], credits: [], totalDebits: 0, totalCredits: 0 };
        actualServerAccountsData[account1.id] = { ...account1 };
        actualServerAccountsData[account2.id] = { ...account2 };

        const newTransaction = {
            id: 'txnTest1',
            description: 'Test Transaction',
            entries: [
                { accountId: account1.id, type: 'debit', amount: 100 },
                { accountId: account2.id, type: 'credit', amount: 100 },
            ]
        };

        const clientSocket2 = new Client(`http://localhost:${port}`);
        clientSocket2.on('connect', () => {
            clientSocket2.on('transactionAdded', (transactionData) => {
                expect(transactionData).toEqual(newTransaction);
                // Check server state
                expect(actualServerTransactions.find(t => t.id === newTransaction.id)).toBeDefined();
                expect(actualServerAccountsData[account1.id].totalDebits).toBe(100);
                expect(actualServerAccountsData[account1.id].debits.length).toBe(1);
                expect(actualServerAccountsData[account2.id].totalCredits).toBe(100);
                expect(actualServerAccountsData[account2.id].credits.length).toBe(1);
                clientSocket2.disconnect();
                done();
            });
            clientSocket.emit('addTransaction', newTransaction);
        });
    });

    // TODO: Add more tests for:
    // - deleteAccount -> accountDeleted
    // - deleteTransaction -> transactionDeleted (and updates to accountsData)
    // - editTransactionDescription -> transactionDescriptionUpdated
    // - accountsArranged -> accountsArrangedUpdate
    // - renameAccount -> accountTitleUpdate
    // - startHighlightTransaction -> highlightTransaction
    // - endHighlightTransaction -> unhighlightTransaction
    // - stateImported -> initialAccounts, initialTransactions
});