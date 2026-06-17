[x] Make sure that the app exportable to npm as a package. We want other people to be able to embed it in their apps. Excalidraw is a good example: https://github.com/excalidraw/excalidraw. Add this as a requirement to AGENTS.md
[x] Make sure that we add to the AGENTS.md file that all drawings on the grid need to be able to defined in yaml. Make sure the yaml definition stays updated when new features are added
[x] Add "To move canvas, hold [Scroll wheel) or|Space while dragging, or use the hand too!" to the top under the toolbar like Excalidraw. Implement these features. Also make sure that we can zoom using pinching, and pan using double fingers
[x] Define what each grid represents (cm, ft, inches, multiple inches, ...). Per default we don't assign a metric, but when we do, we can add sizes to the UI
[ ] Let users associate text with a shape
[ ] Add text as a shape we can add
[x] Update the yaml spec so that we can give unique identifiers (keys) to any element. This will help us refer to the the elements and make test writing easier
[x] Add undo and redo buttons to left bottom corner. Also add configurable zoom percentage there
[x] Allow users to turn on/off snap to grid
[x] Editing shapes should not be in the right sidebar, bit in a new floating element on the left side of the page that only appears when a shape is selected. Similar to excalidraw

[ ] Add prettier to Husky
[x] Fix: Can't add spaces to yaml def
[x] Fix: when you select a freeform component, we should not make it appear like you can resize it
[x] Fix: selecting lines is a bit odd
[ ] Feat: add eraser
[ ] Add notes section where we can write markdown. The goal is to keep track there of what we are graphing and write any additional information. An example of what I want to do is to work with an agent to design a staircase on a slope using 6x6 poles. I want the agent to help me determine what materials I need to buy, how I need to cut the poles to make the most out of the material, etc. These results should appear in the markdown. The notes should live in the yaml spec as markdown
[ ] Feat: Create UI for agent. The agent function is only available for subscribed users, so for now we just need placeholder text indicating that this is a paid feature. The goal is to keep track there of what we are graphing and write any additional information. An example of what I want to do is to work with an agent to design a staircase on a slope using 6x6 poles. I want the agent to help me determine what materials I need to buy, how I need to cut the poles to make the most out of the material, etc. These results should appear in the markdown
[ ] Feat: add mermaid support
[ ] Feat: select multiple shapes and group them together. Also support ungroup
[ ] Feat: add arrows
[x] Feat: add line width / style
[x] Feat: add copy/delete/link action to shapes
[x] Feat: add standard colors
[ ] Feat: explore what else we need to do floor planning
[ ] Feat: show measurements in the UI (smart ruler). What do we need to build to support architect drawings?

[x] When i hit backspace while editing the key, the shape is deleted.
[x] The shape with key squarebig is overlapping squaresmall. Can we change it so that squaresmall appears on top?
[ ] Precision Snap-to-Grid: Allow elements to lock perfectly to grid vertices or lines, ensuring straight walls and right angles.
[ ] Customizable Grid Units: Add a toggle between Metric and Imperial units (e.g., 1 grid square = 1 ft or 10 cm).Orthographic /
[ ] Wall Drawing Modes: Add a line-drawing mode that restricts angles to increments of 90° and 45° for building clean, contiguous structures.
[ ] Smart Rulers: Show dynamic measuring lines that update as the user draws or resizes objects.
[ ] Let users define their own icons and add images.
[ ] Add support for agent to create graphs

<!-- [ ] Image library? -->
<!-- [ ] Add triangles ? -->

# Server

[ ] Create share functionality. Make sure we can have multiple versions of the same grid
[ ] Create account functionality
[ ] Create organization functionality
[ ] Create payment functionality
[ ] Add monetization options
[ ] Add annotation / comment logic. Comments can be tied to a annotation and are tied to a specific version
[ ] Add images to the graph. Think how to solve this for the component
[ ] Add agent support.
