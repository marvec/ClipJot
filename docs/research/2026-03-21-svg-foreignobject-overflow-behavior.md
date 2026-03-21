# SVG foreignObject Overflow Behavior

> **Date:** 2026-03-21
> **Purpose:** Comprehensive reference for foreignObject overflow, clipping, and cross-browser behavior — relevant for ClipJot's canvas-based annotation layer.

---

## Table of Contents

1. [Default Overflow Behavior](#1-default-overflow-behavior)
2. [Overflow Hidden vs Visible](#2-overflow-hidden-vs-visible)
3. [Overflow Scroll](#3-overflow-scroll)
4. [Cross-Browser Differences](#4-cross-browser-differences)
5. [Clip-Path on foreignObject](#5-clip-path-on-foreignobject)
6. [SVG Attribute vs CSS Property](#6-svg-attribute-vs-css-property)
7. [Double-Clipping Problem](#7-double-clipping-problem)
8. [Practical Recommendations](#8-practical-recommendations)
9. [Anti-Patterns to Avoid](#9-anti-patterns-to-avoid)

---

## 1. Default Overflow Behavior

**Key insight:** The SVG spec's initial value for `overflow` is `visible`, but all browser UA stylesheets override it to `hidden` for `foreignObject`.

This means that by default, content inside a `foreignObject` that exceeds its `width`/`height` will be clipped — even though the SVG specification says the initial value is `visible`.

### SVG 2 Spec Overflow Table (Section 3.11)

| Setting | foreignObject Behavior |
| --- | --- |
| Initial (spec) | `visible` |
| UA stylesheet | `hidden` (overrides initial) |
| `auto` | `visible` or `scroll` |
| `visible` | `visible` |
| `hidden` | `hidden` |
| `scroll` | `scroll` |

### Code Example: Default (Clipped)

```html
<!-- Content exceeding 200x100 will be clipped by default -->
<svg width="400" height="400">
  <foreignObject x="10" y="10" width="200" height="100">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <p>This text will be clipped if it exceeds the 200x100 box.</p>
    </div>
  </foreignObject>
</svg>
```

---

## 2. Overflow Hidden vs Visible

### Overflow Hidden (default, most reliable)

```html
<foreignObject x="10" y="10" width="200" height="100"
               style="overflow: hidden;">
  <div xmlns="http://www.w3.org/1999/xhtml">
    Content is clipped at the foreignObject boundary.
  </div>
</foreignObject>
```

### Overflow Visible (unreliable cross-browser)

```html
<foreignObject x="10" y="10" width="200" height="100"
               style="overflow: visible;">
  <div xmlns="http://www.w3.org/1999/xhtml">
    Content may overflow — but browser support varies.
  </div>
</foreignObject>
```

**Cross-browser support for `overflow: visible`:**

| Browser | `overflow: visible` on foreignObject |
| --- | --- |
| Firefox | Best support, generally works correctly |
| Chrome/Edge | Buggy pre-2020, improved since |
| Safari | Historically clips regardless of setting |

### Workaround: Oversized foreignObject

For reliable `overflow: visible` behavior across browsers, use an oversized foreignObject and constrain with CSS:

```html
<!-- The "oversized foreignObject" technique -->
<foreignObject x="10" y="10" width="9999" height="9999">
  <div xmlns="http://www.w3.org/1999/xhtml"
       style="width: 200px; /* constrain with CSS */">
    Content is positioned by CSS, not clipped by foreignObject.
  </div>
</foreignObject>
```

---

## 3. Overflow Scroll

**Best practice:** Apply `overflow: scroll` (or `overflow: auto`) on the **child HTML element** inside foreignObject, not on foreignObject itself. This is the most cross-browser compatible approach.

### Recommended Pattern

```html
<foreignObject x="10" y="10" width="200" height="150">
  <div xmlns="http://www.w3.org/1999/xhtml"
       style="width: 200px; height: 150px; overflow: auto;">
    <p>Long content that needs scrolling...</p>
    <p>More content...</p>
    <p>Even more content...</p>
  </div>
</foreignObject>
```

### Not Recommended

```html
<!-- Avoid: overflow on foreignObject itself is less reliable -->
<foreignObject x="10" y="10" width="200" height="150"
               style="overflow: scroll;">
  ...
</foreignObject>
```

---

## 4. Cross-Browser Differences

### Summary Table

| Feature | Chrome/Edge | Firefox | Safari |
| --- | --- | --- | --- |
| `overflow: hidden` | Works | Works | Works |
| `overflow: visible` | Works (post-2020) | Works | Clips anyway |
| `overflow: scroll` on fo | Partial | Works | Partial |
| `overflow: auto` on child | Works | Works | Works |
| `clip-path` on fo | Works | Works | Buggy with transforms |
| Pointer events inside fo | Works | Works | Works |
| CSS transforms on fo | Works | Works | May cause clipping |

### Safari-Specific Issues

- Safari tends to clip foreignObject content regardless of `overflow: visible`
- CSS transforms applied directly to foreignObject can cause rendering issues
- **Workaround:** Wrap in a `<g>` element and apply transforms there

```html
<!-- Safari-safe transforms -->
<g transform="translate(100, 50) rotate(15)">
  <foreignObject x="0" y="0" width="200" height="100">
    <div xmlns="http://www.w3.org/1999/xhtml">
      Transformed content, Safari-safe.
    </div>
  </foreignObject>
</g>
```

---

## 5. Clip-Path on foreignObject

`clip-path` works on foreignObject in all modern browsers, with one Safari caveat.

### Basic clip-path Usage

```html
<svg width="400" height="400">
  <defs>
    <clipPath id="myClip">
      <circle cx="100" cy="75" r="60"/>
    </clipPath>
  </defs>

  <foreignObject x="10" y="10" width="200" height="150"
                 clip-path="url(#myClip)">
    <div xmlns="http://www.w3.org/1999/xhtml">
      This HTML content is clipped to a circle shape.
    </div>
  </foreignObject>
</svg>
```

### CSS clip-path (Inline)

```html
<foreignObject x="10" y="10" width="200" height="150"
               style="clip-path: inset(10px 20px 10px 20px);">
  <div xmlns="http://www.w3.org/1999/xhtml">
    Clipped with CSS inset.
  </div>
</foreignObject>
```

### Safari Caveat

When combining `clip-path` with transforms on the same foreignObject element, Safari may produce incorrect results. Apply the transform to a parent `<g>` element instead:

```html
<!-- Safari-safe: transform on parent, clip-path on foreignObject -->
<g transform="translate(50, 50)">
  <foreignObject width="200" height="100" clip-path="url(#myClip)">
    ...
  </foreignObject>
</g>
```

---

## 6. SVG Attribute vs CSS Property

**CSS `overflow` property always takes priority** over the SVG `overflow` attribute.

```html
<!-- CSS wins: content will be visible -->
<foreignObject width="200" height="100"
               overflow="hidden"
               style="overflow: visible;">
  <!-- overflow: visible applies -->
</foreignObject>
```

### Specificity Rules

1. Inline `style="overflow: ..."` overrides the `overflow="..."` attribute
2. CSS stylesheet rules override the attribute (with normal specificity)
3. The SVG attribute acts as a presentation attribute (lowest CSS specificity)

### Recommendation

Use CSS properties consistently (either inline `style` or a stylesheet) rather than mixing SVG attributes and CSS. This avoids confusion about which one wins.

---

## 7. Double-Clipping Problem

Content can be clipped at **two levels**:

1. The `<svg>` element's viewport (its own `overflow` property)
2. The `<foreignObject>` element's overflow

Both must allow overflow for content to truly escape its bounds.

### Example: Both Levels Need `overflow: visible`

```html
<!-- Both svg AND foreignObject must allow overflow -->
<svg width="400" height="300" style="overflow: visible;">
  <foreignObject x="10" y="10" width="200" height="100"
                 style="overflow: visible;">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <div style="width: 300px; height: 200px; background: lightblue;">
        This content exceeds both the foreignObject
        and the SVG viewport boundaries.
      </div>
    </div>
  </foreignObject>
</svg>
```

### Common Mistake

```html
<!-- BUG: foreignObject allows overflow but SVG clips it -->
<svg width="400" height="300"> <!-- default overflow: hidden -->
  <foreignObject style="overflow: visible;" ...>
    <!-- Content escapes foreignObject but is clipped at SVG boundary -->
  </foreignObject>
</svg>
```

---

## 8. Practical Recommendations

### Recommendation 1: Use Hidden Overflow + Exact Sizing (Most Reliable)

```html
<foreignObject x="10" y="10" width="200" height="100">
  <div xmlns="http://www.w3.org/1999/xhtml"
       style="width: 200px; height: 100px; overflow: hidden;">
    Content fits within bounds.
  </div>
</foreignObject>
```

### Recommendation 2: For Scrollable Content, Scroll on the Child

```html
<foreignObject x="10" y="10" width="300" height="200">
  <div xmlns="http://www.w3.org/1999/xhtml"
       style="width: 300px; height: 200px; overflow: auto;">
    <!-- Scrollable HTML content here -->
  </div>
</foreignObject>
```

### Recommendation 3: For Overflow-Visible Needs, Use Oversized foreignObject

```html
<foreignObject x="0" y="0" width="9999" height="9999"
               style="overflow: visible;">
  <div xmlns="http://www.w3.org/1999/xhtml"
       style="position: absolute; left: 10px; top: 10px; width: 200px;">
    Content can overflow without clipping in all browsers.
  </div>
</foreignObject>
```

### Recommendation 4: Safari-Safe Transforms

```html
<g transform="translate(100, 50) scale(1.2)">
  <foreignObject x="0" y="0" width="200" height="100">
    <div xmlns="http://www.w3.org/1999/xhtml">Safe in Safari.</div>
  </foreignObject>
</g>
```

### Recommendation 5: Always Include the XHTML Namespace

```html
<foreignObject width="200" height="100">
  <!-- REQUIRED: xmlns on the root HTML element -->
  <div xmlns="http://www.w3.org/1999/xhtml">
    Content here.
  </div>
</foreignObject>
```

---

## 9. Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Do This Instead |
| --- | --- | --- |
| Relying on `overflow: visible` working cross-browser | Safari clips anyway | Use oversized foreignObject technique |
| Putting `overflow: scroll` on foreignObject | Inconsistent cross-browser | Put `overflow: auto` on child HTML |
| Mixing SVG `overflow` attribute and CSS property | Confusing specificity | Use CSS consistently |
| Applying transforms directly to foreignObject | Safari rendering bugs | Wrap in `<g>` and transform that |
| Forgetting `xmlns` on child HTML | Silent rendering failure | Always add `xmlns="http://www.w3.org/1999/xhtml"` |
| Setting only foreignObject overflow without checking SVG | Double-clipping problem | Set overflow on both SVG and foreignObject |

---

## Sources

- **MDN Web Docs:** [`<foreignObject>` element](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/foreignObject)
- **MDN Web Docs:** [SVG `overflow` attribute](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/overflow)
- **MDN Web Docs:** [SVG Clipping and Masking tutorial](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Clipping_and_Masking)
- **SVG 2 Specification:** [Section 3.11 — Overflow and Clip Properties](https://www.w3.org/TR/SVG2/render.html#OverflowAndClipProperties)
- **SVG 2 Specification:** [Section 12.4 — The foreignObject element](https://www.w3.org/TR/SVG2/embedded.html#ForeignObjectElement)
