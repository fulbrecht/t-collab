const Client = require("socket.io-client");
const { server: actualHttpServer, io: actualIo, sessions, DEFAULT_SESSION_ID } = require('./server');

describe("T-Collab Server Integration Tests", () => {
    let clientSocket;
    let serverAccountsData; // Helper to access current session's accounts
    let serverTransactions; // Helper to access current session's transactions
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
        // Ensure the default session exists and is clean
        sessions[DEFAULT_SESSION_ID] = {
            accountsData: {},
            title: "Test Session Title",
            transactions: [],
            connectedUsers: 0,
        };
        serverAccountsData = sessions[DEFAULT_SESSION_ID].accountsData;
        serverTransactions = sessions[DEFAULT_SESSION_ID].transactions;

        // Connect a new client for each test to ensure a clean state for listeners
        // Connect to the default session
        clientSocket = new Client(`http://localhost:${port}?sessionId=${DEFAULT_SESSION_ID}`);
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
            expect(accounts).toEqual([]); // Expect empty initially for the default session
            initialAccountsReceived = true;
            if (initialTransactionsReceived && userCountCorrect) done();
        });

        clientSocket.on('initialTransactions', (transactions) => {
            expect(transactions).toEqual([]); // Expect empty initially for the default session
            initialTransactionsReceived = true;
            if (initialAccountsReceived && userCountCorrect) done();
        });

        clientSocket.on('userCountUpdate', (count) => {
            expect(count).toBe(1); // First client in this session
            userCountCorrect = true;
            if (initialAccountsReceived && initialTransactionsReceived) done();
        });
    });

    test("should handle 'addAccount' and broadcast 'newAccountAdded'", (done) => {
        const newAccount = { id: 'accTest1', title: 'Test Account 1', x: 10, y: 20, debits: [], credits: [], totalDebits: 0, totalCredits: 0 };

        clientSocket.on('newAccountAdded', (accountData) => {
            expect(accountData).toEqual(newAccount);
            expect(serverAccountsData[newAccount.id]).toEqual(newAccount);
            done();
        });

        clientSocket.emit('addAccount', newAccount);
    });

    test("should handle 'clearAllAccounts' and broadcast 'allAccountsCleared'", (done) => {
        // Setup: Add some data to be cleared
        serverAccountsData['accToClear'] = { id: 'accToClear', title: 'To Be Cleared' };
        serverTransactions.push({ id: 'txnToClear', description: 'To Be Cleared Txn' });

        clientSocket.on('allAccountsCleared', () => {
            expect(Object.keys(serverAccountsData).length).toBe(0);
            expect(serverTransactions.length).toBe(0);
            done();
        });

        clientSocket.emit('clearAllAccounts');
    });

    test("should handle 'boxMoved' and broadcast 'boxPositionUpdate' to other clients", (done) => {
        const accountToMove = { id: 'accMove', title: 'Movable Account', x: 0, y: 0, debits: [], credits: [], totalDebits: 0, totalCredits: 0 };
        serverAccountsData[accountToMove.id] = { ...accountToMove }; // Add to server state

        const newPosition = { id: 'accMove', x: 100, y: 150 };

        // Create a second client to listen for the broadcast
        const clientSocket2 = new Client(`http://localhost:${port}?sessionId=${DEFAULT_SESSION_ID}`);
        clientSocket2.on('connect', () => {
            clientSocket2.on('boxPositionUpdate', (updatedPosition) => {
                expect(updatedPosition).toEqual(newPosition);
                expect(serverAccountsData[accountToMove.id].x).toBe(newPosition.x);
                expect(serverAccountsData[accountToMove.id].y).toBe(newPosition.y);
                clientSocket2.disconnect();
                done();
            });

            // Client 1 emits the move event
            clientSocket.emit('boxMoved', newPosition);
        });
    });

    // This test will be replaced by the more specific transaction tests below
    // test("should handle 'addTransaction', update server state, and broadcast 'transactionAdded'", (done) => {
    //     const account1 = { id: 'accTxn1', title: 'Txn Acc 1', x: 0, y: 0, debits: [], credits: [], totalDebits: 0, totalCredits: 0 };
    //     const account2 = { id: 'accTxn2', title: 'Txn Acc 2', x: 0, y: 0, debits: [], credits: [], totalDebits: 0, totalCredits: 0 };
    //     serverAccountsData[account1.id] = { ...account1 };
    //     serverAccountsData[account2.id] = { ...account2 };

    //     const newTransaction = {
    //         id: 'txnTest1',
    //         description: 'Test Transaction',
    //         entries: [
    //             { accountId: account1.id, type: 'debit', amount: 100 },
    //             { accountId: account2.id, type: 'credit', amount: 100 },
    //         ]
    //     };

    //     const clientSocket2 = new Client(`http://localhost:${port}?sessionId=${DEFAULT_SESSION_ID}`);
    //     clientSocket2.on('connect', () => {
    //         clientSocket2.on('transactionAdded', (transactionData) => {
    //             expect(transactionData).toEqual(newTransaction);
    //             // Check server state
    //             expect(serverTransactions.find(t => t.id === newTransaction.id)).toBeDefined();
    //             expect(serverAccountsData[account1.id].totalDebits).toBe(100);
    //             expect(serverAccountsData[account1.id].debits.length).toBe(1);
    //             expect(serverAccountsData[account2.id].totalCredits).toBe(100);
    //             expect(serverAccountsData[account2.id].credits.length).toBe(1);
    //             clientSocket2.disconnect();
    //             done();
    //         });
    //         clientSocket.emit('addTransaction', newTransaction);
    //     });
    // });


    describe("Transaction Add - Duplicate Account Validation", () => {
        let consoleWarnSpy;

        beforeEach(() => {
            // Mock console.warn
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Setup initial accounts for transaction tests
            serverAccountsData['acc1'] = { id: 'acc1', title: 'Account 1', debits: [], credits: [], totalDebits: 0, totalCredits: 0, x:0, y:0 };
            serverAccountsData['acc2'] = { id: 'acc2', title: 'Account 2', debits: [], credits: [], totalDebits: 0, totalCredits: 0, x:0, y:0 };
            serverAccountsData['acc3'] = { id: 'acc3', title: 'Account 3', debits: [], credits: [], totalDebits: 0, totalCredits: 0, x:0, y:0 };
        });

        afterEach(() => {
            // Restore console.warn
            consoleWarnSpy.mockRestore();
        });

        test("should process a valid transaction with unique debit/credit accounts", (done) => {
            const validTransaction = {
                id: 'txnValid',
                description: 'Valid Transaction',
                entries: [
                    { accountId: 'acc1', type: 'debit', amount: 100 },
                    { accountId: 'acc2', type: 'credit', amount: 100 },
                ]
            };

            const transactionAddedHandler = jest.fn();
            clientSocket.on('transactionAdded', transactionAddedHandler);

            clientSocket.emit('addTransaction', validTransaction);

            // Use a timeout to allow event propagation
            setTimeout(() => {
                expect(transactionAddedHandler).toHaveBeenCalledWith(expect.objectContaining({ id: 'txnValid' }));
                expect(serverTransactions.find(t => t.id === 'txnValid')).toBeDefined();
                expect(consoleWarnSpy).not.toHaveBeenCalled();
                done();
            }, 50); // Adjust timeout as needed
        });

        test("should reject a transaction with duplicate debit account IDs", (done) => {
            const duplicateDebitTransaction = {
                id: 'txnDupDebit',
                description: 'Duplicate Debit Transaction',
                entries: [
                    { accountId: 'acc1', type: 'debit', amount: 50 },
                    { accountId: 'acc1', type: 'debit', amount: 50 },
                    { accountId: 'acc2', type: 'credit', amount: 100 },
                ]
            };

            const transactionAddedHandler = jest.fn();
            clientSocket.on('transactionAdded', transactionAddedHandler);

            clientSocket.emit('addTransaction', duplicateDebitTransaction);

            setTimeout(() => {
                expect(transactionAddedHandler).not.toHaveBeenCalled();
                expect(serverTransactions.find(t => t.id === 'txnDupDebit')).toBeUndefined();
                expect(consoleWarnSpy).toHaveBeenCalledWith('Duplicate debit account ID:', 'acc1');
                done();
            }, 50);
        });

        test("should reject a transaction with duplicate credit account IDs", (done) => {
            const duplicateCreditTransaction = {
                id: 'txnDupCredit',
                description: 'Duplicate Credit Transaction',
                entries: [
                    { accountId: 'acc1', type: 'debit', amount: 100 },
                    { accountId: 'acc2', type: 'credit', amount: 50 },
                    { accountId: 'acc2', type: 'credit', amount: 50 },
                ]
            };

            const transactionAddedHandler = jest.fn();
            clientSocket.on('transactionAdded', transactionAddedHandler);

            clientSocket.emit('addTransaction', duplicateCreditTransaction);

            setTimeout(() => {
                expect(transactionAddedHandler).not.toHaveBeenCalled();
                expect(serverTransactions.find(t => t.id === 'txnDupCredit')).toBeUndefined();
                expect(consoleWarnSpy).toHaveBeenCalledWith('Duplicate credit account ID:', 'acc2');
                done();
            }, 50);
        });

        test("should reject a transaction with duplicate debit and duplicate credit account IDs", (done) => {
            const duplicateBothTransaction = {
                id: 'txnDupBoth',
                description: 'Duplicate Both Transaction',
                entries: [
                    { accountId: 'acc1', type: 'debit', amount: 50 },
                    { accountId: 'acc1', type: 'debit', amount: 50 },
                    { accountId: 'acc2', type: 'credit', amount: 50 },
                    { accountId: 'acc2', type: 'credit', amount: 50 },
                ]
            };
            const transactionAddedHandler = jest.fn();
            clientSocket.on('transactionAdded', transactionAddedHandler);

            clientSocket.emit('addTransaction', duplicateBothTransaction);

            setTimeout(() => {
                expect(transactionAddedHandler).not.toHaveBeenCalled();
                expect(serverTransactions.find(t => t.id === 'txnDupBoth')).toBeUndefined();
                // It should be caught by the debit check first
                expect(consoleWarnSpy).toHaveBeenCalledWith('Duplicate debit account ID:', 'acc1');
                done();
            }, 50);
        });

        test("should reject a transaction with a single account duplicated in entries (e.g. AccA debit 50, AccA debit 50, AccB credit 100)", (done) => {
            const singleAccountDuplicateTransaction = {
                id: 'txnSingleAccDup',
                description: 'Single Account Duplicate Transaction',
                entries: [
                    { accountId: 'acc1', type: 'debit', amount: 50 },
                    { accountId: 'acc1', type: 'debit', amount: 50 },
                    { accountId: 'acc2', type: 'credit', amount: 100 },
                ]
            };

            const transactionAddedHandler = jest.fn();
            clientSocket.on('transactionAdded', transactionAddedHandler);

            clientSocket.emit('addTransaction', singleAccountDuplicateTransaction);

            setTimeout(() => {
                expect(transactionAddedHandler).not.toHaveBeenCalled();
                expect(serverTransactions.find(t => t.id === 'txnSingleAccDup')).toBeUndefined();
                expect(consoleWarnSpy).toHaveBeenCalledWith('Duplicate debit account ID:', 'acc1');
                done();
            }, 50);
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