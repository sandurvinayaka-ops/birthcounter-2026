
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface WorldMapProps {
  activeCountryId: string | null;
}

const WorldMap: React.FC<WorldMapProps> = ({ activeCountryId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => setGeoData(data));
  }, []);

  useEffect(() => {
    if (!geoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll("*").remove();

    // Adjusted projection scale and translation for ultra-wide-short screens
    const projection = d3.geoMercator()
      .scale(width / 6.2)
      .translate([width / 2, height / 1.7]);

    const path = d3.geoPath().projection(projection);

    const mapGroup = svg.append("g");

    mapGroup.selectAll("path")
      .data(geoData.features)
      .enter()
      .append("path")
      .attr("d", (d: any) => path(d))
      .attr("fill", "#0f172a")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 0.5)
      .attr("class", (d: any) => `country-${d.id}`)
      .style("transition", "fill 0.4s ease");

    const resizeObserver = new ResizeObserver(() => {
        if (!svgRef.current) return;
        const newWidth = svgRef.current.clientWidth;
        const newHeight = svgRef.current.clientHeight;
        projection.scale(newWidth / 6.2).translate([newWidth / 2, newHeight / 1.7]);
        mapGroup.selectAll("path").attr("d", (d: any) => path(d));
    });
    resizeObserver.observe(svgRef.current);

    return () => resizeObserver.disconnect();
  }, [geoData]);

  useEffect(() => {
    if (!geoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    
    if (activeCountryId) {
      const isBoy = Math.random() > 0.5;
      const highlightColor = isBoy ? "#3b82f6" : "#ec4899";
      
      svg.select(`.country-${activeCountryId}`)
        .interrupt()
        .attr("fill", highlightColor)
        .attr("filter", `drop-shadow(0 0 15px ${highlightColor})`)
        .transition()
        .duration(800)
        .attr("fill", "#0f172a")
        .attr("filter", "none");
    }
  }, [activeCountryId, geoData]);

  return (
    <div className="w-full h-full flex items-center justify-center p-2">
      <svg 
        ref={svgRef} 
        className="w-full h-full"
      />
    </div>
  );
};

export default WorldMap;
