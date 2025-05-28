import { socket } from './socketService.js';
import { svgWidth, svgHeight, tAccountWidth, tAccountHeight } from './config.js';

export function dragstarted(event, d) {
    d3.select(this).raise().classed("dragging", true);
}

export function dragged(event, d) {
    let newX = event.x;
    let newY = event.y;

    d.x = Math.max(0, Math.min(newX, svgWidth - tAccountWidth));
    d.y = Math.max(0, Math.min(newY, svgHeight - tAccountHeight));

    d3.select(this).attr("transform", `translate(${d.x}, ${d.y})`);
    socket.emit('boxMoved', { id: d.id, x: d.x, y: d.y });
}

export function dragended(event, d) {
    d3.select(this).classed("dragging", false);
}

export const dragBehavior = d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);