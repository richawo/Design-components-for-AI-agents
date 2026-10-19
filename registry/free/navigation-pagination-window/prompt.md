# Pagination Window

Build a self-contained React 19, Tailwind v4 and motion/react pagination component with the existing typed API, named export and overridable default demo.

## Layout and type

A compact pagination landmark with a quiet result-set label, monospaced current-page caption and a fixed-height 44px travelling page rail. Keep five slots in narrow containers and seven when space allows, with first/last destinations and non-interactive ellipses. The current page has a clear 3:1 outline; Previous and Next remain separate 44px controls below. Keep neutral graphite surfaces, readable 14px page labels and 12px caption type.

## Interaction

Preserve PaginationWindowProps and the named PaginationWindow export. Use defaultPage for local state or page with onPageChange for controlled acknowledgement. Controlled navigation without a writer is disabled.

Normalize finite page totals to non-negative integers up to Number.MAX_SAFE_INTEGER and clamp the current page to the available range. Invalid totals show no pages; invalid selected positions use page one when pages exist. Do not notify for a current-page or out-of-range request.

Keep the bounded five/seven-slot page window, 44px rail height and actual first/last destinations. Size from the rail container with ResizeObserver; retained page controls animate through intermediate horizontal positions.

Use native buttons and exact one-based accessible page names. Mark the actual current destination with aria-current=page and expose the current caption through a status. Ellipses and retiring slots are non-interactive; retired copies are hidden and inert.

Keep page focus when the window resizes or the host clamps a removed page. If no enabled destination remains, focus the outlined navigation landmark. Do not take focus from an outside control.

Keep large visible page labels within their targets using compact labels and scientific fallback, with full page numbers in accessible names and titles. The current-page outline meets at least 3:1 contrast.

Callbacks are synchronous navigation requests. The host owns route changes, result loading and persistence; a refused controlled request retains the actual current page.

## Motion

Enter the navigation landmark with opacity and an 8px rise over 280ms. Keep the travelling rail and shared selected plate at 260/280ms. New/retiring slots use owned 260ms vertical entries/exits with 120ms opacity. The keyed current caption enters over 180ms without retaining old captions. Subscribe independently to live prefers-reduced-motion changes, including retiring slots. Stop and settle owned controls immediately, retire old copies, remove projection transforms and render a static selected plate.

## Integration

Use defaultPage for local navigation or page with onPageChange for controlled acknowledgement. Supply the actual pageCount; invalid totals have a written empty state. The callback proposes a valid one-based destination synchronously, and the host loads results or changes routes. Full page numbers remain available to assistive technology when visible labels are compact.

Use the source dark/light palettes and verify 320/390/768/1024/1440/1920px container layouts.
