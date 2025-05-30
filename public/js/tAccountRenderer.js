import { svg } from './svgService.js';
import * as state from './state.js';
import { tAccountWidth, tAccountHeight, headerHeight, totalsHeight, columnLabelYOffset } from './config.js';
import { dragBehavior } from './dragController.js';
import { showRenameInput, deleteAccount } from './tAccountActions.js'; // Forward declaration, will be defined
import { highlightTransactionEntries } from './transactionRenderer.js'; // Import for highlighting
import { socket } from './socketService.js'; // Import for emitting highlight events

export function buildTAccountStructure(selection) {
    selection.append("rect")
        .attr("class", "t-account-box")
        .attr("width", tAccountWidth)
        .attr("height", tAccountHeight);

    selection.append("text")
        .attr("class", "t-account-title-text")
        .attr("x", tAccountWidth / 2)
        .attr("y", headerHeight / 2)
        .text(d => d.title)
        .style("pointer-events", "auto")
        .on("dblclick", function(event, d) {
            event.stopPropagation();
            const groupElement = d3.select(this.parentNode);
            showRenameInput(d, groupElement, this);
        });

    selection.append("line")
        .attr("class", "t-account-line")
        .attr("x1", 0).attr("y1", headerHeight)
        .attr("x2", tAccountWidth).attr("y2", headerHeight);

    selection.append("line")
        .attr("class", "t-account-line")
        .attr("x1", tAccountWidth / 2).attr("y1", headerHeight)
        .attr("x2", tAccountWidth / 2).attr("y2", tAccountHeight);

    selection.append("text")
        .attr("class", "delete-account-btn")
        .attr("x", tAccountWidth - 10)
        .attr("y", 15)
        .style("cursor", "pointer")
        .style("font-size", "18px")
        .style("fill", "#E74C3C")
        .style("pointer-events", "auto")
        .text("X")
        .on("click", function(event, d) {
            event.stopPropagation();
            if (confirm(`Delete account "${d.title}"? This will also delete all related transactions.`)) {
                deleteAccount(d.id);
            }
        });

    selection.append("text")
        .attr("class", "t-account-column-label")
        .attr("x", tAccountWidth / 4)
        .attr("y", columnLabelYOffset)
        .text("Debits");

    selection.append("text")
        .attr("class", "t-account-column-label")
        .attr("x", (tAccountWidth / 4) * 3)
        .attr("y", columnLabelYOffset)
        .text("Credits");

    selection.append("line")
        .attr("class", "t-account-line")
        .attr("x1", 0).attr("y1", tAccountHeight - totalsHeight)
        .attr("x2", tAccountWidth).attr("y2", tAccountHeight - totalsHeight);

    selection.append("text")
        .attr("class", "debit-total t-account-total-text")
        .attr("x", tAccountWidth / 4)
        .attr("y", tAccountHeight - totalsHeight / 2)
        .text("");

    selection.append("text")
        .attr("class", "credit-total t-account-total-text")
        .attr("x", (tAccountWidth / 4) * 3)
        .attr("y", tAccountHeight - totalsHeight / 2)
        .text("");
}

export function renderTAccounts() {
    const groups = svg.selectAll(".draggable-group")
        .data(state.getAccounts(), d => d.id);

    groups.exit().remove();

    const newGroups = groups.enter()
        .append("g")
        .attr("class", "draggable-group")
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
        .call(dragBehavior);

    buildTAccountStructure(newGroups);

    const allGroups = groups.merge(newGroups);
    allGroups.each(function(d) {
        const group = d3.select(this);
        const netTotal = d.totalDebits - d.totalCredits;
        if(netTotal > 0){
            group.select(".debit-total").text(`${netTotal.toFixed(2)}`);
        } else if(netTotal < 0){
            group.select(".credit-total").text(`${(-netTotal).toFixed(2)}`);
        } else {
            group.select(".debit-total").text("");
            group.select(".credit-total").text("");
        
        }
        

        const debitEntries = group.selectAll(".debit-entry-text").data(d.debits, entry => entry.id);
        debitEntries.exit().remove();
        debitEntries.enter().append("text")
            .attr("class", "debit-entry-text")
            .attr("x", tAccountWidth / 4)
            .merge(debitEntries)
            .attr("y", (entry, i) => columnLabelYOffset + 20 + (i * 15))
            .text(entry => entry.amount.toFixed(2))
            .attr("data-transaction-id", entry => entry.transactionId)
            .style("pointer-events", "auto") // Apply to merged selection
            .style("cursor", "default")      // Apply to merged selection
            .on('mouseover', function(event, entry) {
                socket.emit('startHighlightTransaction', { transactionId: entry.transactionId });
                highlightTransactionEntries(entry.transactionId, true, 'local');
            })
            .on('mouseout', function(event, entry) {
                socket.emit('endHighlightTransaction', { transactionId: entry.transactionId });
                highlightTransactionEntries(entry.transactionId, false, 'local');
            });
            
        const creditEntries = group.selectAll(".credit-entry-text").data(d.credits, entry => entry.id);
        creditEntries.exit().remove();
        creditEntries.enter().append("text")
            .attr("class", "credit-entry-text")
            .attr("x", (tAccountWidth / 4) * 3)
            .merge(creditEntries)
            .attr("y", (entry, i) => columnLabelYOffset + 20 + (i * 15))
            .text(entry => entry.amount.toFixed(2))
            .attr("data-transaction-id", entry => entry.transactionId)
            .style("pointer-events", "auto") // Apply to merged selection
            .style("cursor", "default")      // Apply to merged selection
            .on('mouseover', function(event, entry) {
                socket.emit('startHighlightTransaction', { transactionId: entry.transactionId });
                highlightTransactionEntries(entry.transactionId, true, 'local');
            })
            .on('mouseout', function(event, entry) {
                socket.emit('endHighlightTransaction', { transactionId: entry.transactionId });
                highlightTransactionEntries(entry.transactionId, false, 'local');
            });
    });
    groups.attr("transform", d => `translate(${d.x}, ${d.y})`);
}