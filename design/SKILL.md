---
name: cogra-design
description: Use this skill to generate well-branded interfaces and assets for CoGra, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and the component library. The drawn screens in designs/canonical/ and their behavior sidecars in designs/canonical/behavior/ are the implementation contract; new screens are built from these components.
user-invocable: true
---

Read the readme.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, the boards in `designs/canonical/` (wired by its `graph.json` and `flows.json`) and the sidecars in `designs/canonical/behavior/` are the contract: build what they draw and cite board files, never canvas URLs (readme §14). Copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
