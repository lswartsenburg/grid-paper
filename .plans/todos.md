[x] Make sure that the app exportable to npm as a package. We want other people to be able to embed it in their apps. Excalidraw is a good example: https://github.com/excalidraw/excalidraw. Add this as a requirement to AGENTS.md
[ ] Make sure that we add to the AGENTS.md file that all drawings on the grid need to be able to defined in yaml. Make sure the yaml definition stays updated when new features are added
[x] Add "To move canvas, hold [Scroll wheel) or|Space while dragging, or use the hand too!" to the top under the toolbar like Excalidraw. Implement these features. Also make sure that we can zoom using pinching, and pan using double fingers
[ ] Define what each grid represents (cm, ft, inches, multiple inches, ...). Per default we don't assign a metric, but when we do, we can add sizes to the UI
[ ] Let users associate text with a shape?
[x] Update the yaml spec so that we can give unique identifiers (keys) to any element. This will help us refer to the the elements and make test writing easier
[ ] Add snap to grid function. Make this the default setting
[ ] Editing shapes should not be in the right sidebar, bit in a new floating element on the left side of the page that only appears when a shape is selected. Similar to excalidraw
[ ] Add annotation logic
[ ] Associate text with shapes
[ ] Add text as a shape we can add
[x] When i hit backspace while editing the key, the shape is deleted.
[x] The shape with key squarebig is overlapping squaresmall. Can we change it so that squaresmall appears on top?
[ ] Precision Snap-to-Grid: Allow elements to lock perfectly to grid vertices or lines, ensuring straight walls and right angles.
[ ] Customizable Grid Units: Add a toggle between Metric and Imperial units (e.g., 1 grid square = 1 ft or 10 cm).Orthographic /
[ ] Wall Drawing Modes: Add a line-drawing mode that restricts angles to increments of 90° and 45° for building clean, contiguous structures.
[ ] Smart Rulers: Show dynamic measuring lines that update as the user draws or resizes objects.
[ ] Let users define their own icons and add images.

<!-- [ ] Image library? -->

<!-- [ ] Add grid settings to yaml definition? -->

[x] Add undo and redo buttons to left bottom corner. Also add configurable zoom percentage there

<!-- [ ] Add triangles ? -->

[ ]
