import { useEffect, useRef, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { FileNode } from '../types'
import { DIRECTORY_COLOR, getFileColor, getTextColor } from '../utils/colors'
import { formatSize } from '../utils/format'

interface TreemapProps {
  data: FileNode
  onSelect: (node: FileNode) => void
  selectedFile: FileNode | null
}

/** Maximum number of tiles rendered at once to keep the DOM manageable. */
const MAX_VISIBLE_NODES = 500

export default function Treemap({ data, onSelect, selectedFile }: TreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  /**
   * Build a flat D3 hierarchy from the *direct children* of the current node.
   * Using leaves of the full subtree would create thousands of SVG elements for
   * large directories; showing direct children limits DOM nodes to at most
   * MAX_VISIBLE_NODES + 1 ("others") tiles while still conveying relative sizes.
   */
  const hierarchy = useMemo(() => {
    // Sort by size descending so the slice always keeps the largest items.
    const children = (data.children || []).slice().sort((a, b) => b.size - a.size)

    // Show the top MAX_VISIBLE_NODES children by size; group the rest into an
    // "others" aggregate tile so the treemap always sums to 100 %.
    const visible = children.slice(0, MAX_VISIBLE_NODES)
    const hidden = children.slice(MAX_VISIBLE_NODES)
    const othersSize = hidden.reduce((acc, c) => acc + c.size, 0)

    const shallowChildren: FileNode[] = visible.map((child) => ({
      name: child.name,
      path: child.path,
      size: child.size,
      isDirectory: child.isDirectory,
      extension: child.extension,
      childCount: child.childCount,
      // Strip nested children — we only render one level deep.
    }))

    if (othersSize > 0) {
      shallowChildren.push({
        name: `+${hidden.length} more`,
        path: '__others__',
        size: othersSize,
        isDirectory: false,
      })
    }

    const shallowRoot: FileNode = {
      name: data.name,
      path: data.path,
      // Set size to 0 so D3's .sum() aggregates only from the leaf children,
      // avoiding double-counting the root's pre-computed total size.
      size: 0,
      isDirectory: true,
      children: shallowChildren,
    }

    return d3
      .hierarchy(shallowRoot)
      // All depth-1 nodes are leaves (children stripped), so use d.size directly.
      .sum((d) => d.size)
      .sort((a, b) => (b.value || 0) - (a.value || 0))
  }, [data])

  useEffect(() => {
    if (!svgRef.current) return

    const { width, height } = containerSize
    if (width === 0 || height === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const treemapLayout = d3.treemap<FileNode>()
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(3)
      .round(true)

    const root = treemapLayout(hierarchy)
    const leaves = root.leaves()

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')

    // Create cells
    const cell = g.selectAll('g')
      .data(leaves)
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        if (d.data.path !== '__others__') onSelect(d.data)
      })

    // Rectangles
    cell.append('rect')
      .attr('width', (d) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d) => Math.max(0, d.y1 - d.y0))
      .attr('rx', 3)
      .attr('fill', (d) => d.data.isDirectory ? DIRECTORY_COLOR : getFileColor(d.data.extension))
      .attr('opacity', (d) => selectedFile?.path === d.data.path ? 1 : 0.85)
      .attr('stroke', (d) => selectedFile?.path === d.data.path ? '#0F172A' : 'rgba(255,255,255,0.25)')
      .attr('stroke-width', 2)
      .on('mouseenter', function () {
        d3.select(this).attr('opacity', 1)
      })
      .on('mouseleave', function (_, d) {
        d3.select(this).attr('opacity', selectedFile?.path === d.data.path ? 1 : 0.85)
      })

    // Labels (only for cells large enough)
    cell
      .filter((d) => (d.x1 - d.x0) > 60 && (d.y1 - d.y0) > 30)
      .append('text')
      .attr('x', 6)
      .attr('y', 16)
      .text((d) => {
        const maxChars = Math.floor((d.x1 - d.x0 - 12) / 7)
        const name = d.data.name
        return name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name
      })
      .attr('font-size', '11px')
      .attr('font-family', 'Inter, sans-serif')
      .attr('fill', (d) => getTextColor(d.data.isDirectory ? DIRECTORY_COLOR : getFileColor(d.data.extension)))
      .attr('font-weight', '500')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.3)')

    // Size labels
    cell
      .filter((d) => (d.x1 - d.x0) > 60 && (d.y1 - d.y0) > 45)
      .append('text')
      .attr('x', 6)
      .attr('y', 30)
      .text((d) => formatSize(d.data.size))
      .attr('font-size', '10px')
      .attr('font-family', 'Inter, sans-serif')
      .attr('fill', (d) => {
        const textColor = getTextColor(d.data.isDirectory ? DIRECTORY_COLOR : getFileColor(d.data.extension))
        return textColor === '#FFFFFF' ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.85)'
      })
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.3)')

  }, [containerSize, hierarchy, onSelect, selectedFile])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect()
      setContainerSize((currentSize) => {
        if (currentSize.width === width && currentSize.height === height) {
          return currentSize
        }

        return { width, height }
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden bg-cream-200 border border-cream-300">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  )
}
