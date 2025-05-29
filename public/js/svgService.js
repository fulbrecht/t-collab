import { svgWidth, svgHeight } from './config.js';

export const svg = d3.select("body").append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight);

export const userCountText = svg.append("text")
    .attr("x", svgWidth - 10)
    .attr("y", 20)
    .attr("text-anchor", "end")
    .style("font-size", "12px")
    .style("fill", "#555")
    .text("Users: 0");