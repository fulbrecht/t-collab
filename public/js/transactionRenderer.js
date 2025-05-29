import { svg } from './svgService.js';
import * as state from './state.js';
import * as dom from './domElements.js';
import { handleDeleteTransaction, handleEditTransactionDescriptionInPlace } from './transactionActions.js'; // Forward declaration
import { socket } from './socketService.js';

export function renderTransactionList() {
    dom.transactionListUl.innerHTML = '';
    state.getTransactions().forEach(txn => {
        const listItem = document.createElement('li');
        listItem.className = 'transaction-list-item';
        listItem.textContent = txn.description || `Transaction ${txn.id}`;
        listItem.setAttribute('data-transaction-id', txn.id);

        listItem.addEventListener('mouseover', () => {
            socket.emit('startHighlightTransaction', { transactionId: txn.id });
            highlightTransactionEntries(txn.id, true, 'local');
        });
        listItem.addEventListener('mouseout', () => {
            socket.emit('endHighlightTransaction', { transactionId: txn.id });
            highlightTransactionEntries(txn.id, false, 'local');
        });
        listItem.addEventListener('dblclick', function(event) {
            event.stopPropagation();
            handleEditTransactionDescriptionInPlace(txn, this);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.className = 'transaction-delete-btn';
        deleteBtn.onclick = (event) => { event.stopPropagation(); handleDeleteTransaction(txn.id, txn.description); };
        listItem.appendChild(deleteBtn);
        dom.transactionListUl.appendChild(listItem);
    });
}

export function highlightTransactionEntries(transactionId, shouldHighlight, highlightType = 'local') {
    const entrySelector = ".debit-entry-text, .credit-entry-text";
    const listItemSelector = '.transaction-list-item';
    const localEntryClass = 'local-highlight-entry', remoteEntryClass = 'remote-highlight-entry';
    const localListItemClass = 'local-highlight-list-item', remoteListItemClass = 'remote-highlight-list-item';
    const entryClassToApply = highlightType === 'local' ? localEntryClass : remoteEntryClass;
    const listItemClassToApply = highlightType === 'local' ? localListItemClass : remoteListItemClass;

    if (!shouldHighlight) {
        svg.selectAll(entrySelector).classed(localEntryClass, false).classed(remoteEntryClass, false);
        d3.select(dom.transactionListUl).selectAll(listItemSelector).classed(localListItemClass, false).classed(remoteListItemClass, false);
    }
    svg.selectAll(entrySelector).filter(function() { return d3.select(this).attr('data-transaction-id') === transactionId; }).classed(entryClassToApply, shouldHighlight);
    d3.select(dom.transactionListUl).selectAll(listItemSelector).filter(function() { return this.getAttribute('data-transaction-id') === transactionId; }).classed(listItemClassToApply, shouldHighlight);
}