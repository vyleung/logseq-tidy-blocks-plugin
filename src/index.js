import "@logseq/libs";
import { setDriftlessTimeout } from "driftless";

const settings = [
  {
    key: "KeyboardShortcut_LineBreak",
    title: "Keyboard shortcut to tidy block(s) and keep a line break",
    description: "This is the the keyboard shortcut to tidy one block or multiple blocks and keep a line break (default: alt+t)",
    type: "string",
    default: "alt+t"
  },
  {
    key: "KeyboardShortcut_RemoveAll",
    title: "Keyboard shortcut to tidy block(s) and remove all whitespace",
    description: "This is the the keyboard shortcut to tidy one block or multiple blocks and remove all whitespace (default: alt+r)",
    type: "string",
    default: "alt+r"
  },
  {
    key: "ToggleBlockProperties",
    title: "Toggle block properties?",
    description: "Automatic: Automatically hide all block properties and have the ability to toggle them | Manual: Use the slash command to hide the properties per block | None: Leave block properties as is (default: manual)",
    type: "enum",
    enumPicker: "radio",
    enumChoices: ["automatic", "manual", "none"],
    default: "manual"
  },
  {
    key: "KeyboardShortcut_ToggleBlockProperties",
    title: "Keyboard shortcut to toggle block properties",
    description: "This is the the keyboard shortcut to toggle block properties (default: mod+ctrl+x)",
    type: "string",
    default: "mod+ctrl+x"
  }
]
logseq.useSettingsSchema(settings);
const up_icon = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-chevron-up" width="22" height="22" viewBox="0 0 24 24" stroke-width="2" stroke="var(--ls-primary-text-color)" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path stroke="none" d="M0 0h24v24H0z" fill="none"/>
<polyline points="6 15 12 9 18 15" />
</svg>`;
const down_icon = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-chevron-down" width="22" height="22" viewBox="0 0 24 24" stroke-width="2" stroke="var(--ls-primary-text-color)" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path stroke="none" d="M0 0h24v24H0z" fill="none"/>
<polyline points="6 9 12 15 18 9" />
</svg>`;
let tidy_type;
let parent_block_uuid;
let all_blocks_with_properties;
let selected_block_with_properties;
let all_blocks_with_buttons;
let button_block_uuid;
let button_block_properties;
let block_properties;
let toggle_icon_container;
let toggle_icon;

// ref for traversing through a block and their children: https://gist.github.com/umidjons/6865350#file-walk-dom-js
function tidy(block) {
  logseq.Editor.getBlock(block.uuid, {includeChildren: true}).then(tree_block => {
    let block_content = tree_block.content;

    if (tidy_type == "keep a line break") {
      // ref for replacing extra spaces and tabs (1st .replace()): https://stackoverflow.com/questions/5310821/removing-space-and-retaining-the-new-line
      // ref for replacing extra line breaks (2nd .replace()): https://stackoverflow.com/questions/22962220/remove-multiple-line-breaks-n-in-javascript
      logseq.Editor.updateBlock(tree_block.uuid, block_content.trim().replace(/[ \t]{2,}/gu, " ").replace(/[\r\n]{2,}/g, "\n"));
    }
    else {
      // ref for removing all whitespace: https://github.com/sindresorhus/condense-whitespace
      logseq.Editor.updateBlock(tree_block.uuid, block_content.trim().replace(/\s{2,}/gu, " ").replace(/[\r\n]/g, " "));
    }

    if (tree_block.children.length > 0) {
      let children_block = tree_block.children;
      children_block.forEach(child => {
        tidy(child);
      });
    }
  });
}

// tidy one selected block
function tidySelectedBlock(e) {
  tidy(e);
  logseq.UI.showMsg("Block is tidied!")
}

// tidy multiple selected blocks
function tidyMultipleSelectedBlocks() {
  logseq.Editor.getSelectedBlocks().then(selected_blocks => {
    selected_blocks.forEach(selected_block => {
      tidy(selected_block);
    });
  });
  logseq.UI.showMsg("Blocks are tidied!");
}

function tidyBlocks(e) {
  // if the uuid exists, one block has been selected; otherwise, multiple blocks have been selected
  (e.uuid) ? tidySelectedBlock(e) : tidyMultipleSelectedBlocks();
}

logseq.onSettingsChanged(updated_settings => {
  if (logseq.settings.ToggleBlockProperties == "automatic") {
    const mutation_observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        insertToggleBlockPropertiesButton("automatic", "");
      }
    });
    mutation_observer.observe(parent.document.body, {
      childList: true,
      subtree: true
    });
    logseq.beforeunload(async () => {
      mutation_observer.disconnect();
    });
  }
  else if (logseq.settings.ToggleBlockProperties == "manual") {
    // right click - hide block properties
    logseq.Editor.registerBlockContextMenuItem("🧹 Tidy up & hide block properties", async (e) => {
      insertToggleBlockPropertiesButton("manual", e);
    });

    // slash command - hide block properties
    logseq.Editor.registerSlashCommand("🧹 Tidy up & hide block properties", async (e) => {
      insertToggleBlockPropertiesButton("manual", e);
    });

     // keyboard shortcut: hide block properties
    logseq.App.registerCommandPalette({
      key: `tidy-blocks-ToggleBlockProperties`,
      label: "Tidy up & toggle all block properties",
      keybinding: {
        binding: logseq.settings.KeyboardShortcut_ToggleBlockProperties,
        mode: "global",
      }
    }, async () => {
      logseq.Editor.checkEditing().then(editing_block => {
        if (editing_block) {
          insertToggleBlockPropertiesButton("manual", editing_block);
        }
        else {
          logseq.Editor.getSelectedBlocks().then(all_selected_blocks => {
            all_selected_blocks.forEach(a_selected_block => {
              insertToggleBlockPropertiesButton("manual", a_selected_block);
            });
          });
        }
      });
    });
  }
});

function insertToggleBlockPropertiesButton(type, block) {
  if (type == "automatic") {
    // get all blocks that have properties
    all_blocks_with_properties = parent.document.querySelectorAll(".block-properties");

    if (all_blocks_with_properties) {
      // for each block that has properties, if the block-properties div doesn't have an id, add one and insert the toggle button
      for (const block_with_properties of all_blocks_with_properties) {
        if (!block_with_properties.id) {
          parent_block_uuid = block_with_properties.parentElement.id.split("block-content-")[1];
          block_with_properties.id = `tidy-block-properties-${parent_block_uuid}`;
          showToggleBlockPropertiesButton(parent_block_uuid);
        }
      }
    }
  }
  else {
    (block.uuid) ? parent_block_uuid = block.uuid : parent_block_uuid = block;

    logseq.Editor.exitEditingMode();
    showToggleBlockPropertiesButton(parent_block_uuid);

    setDriftlessTimeout(() => {
      selected_block_with_properties = parent.document.querySelector(`#block-content-${parent_block_uuid} > .block-properties`);

      if (!selected_block_with_properties.id) {
        selected_block_with_properties.id = `tidy-block-properties-${parent_block_uuid}`;
      }
    }, 50);
  }
}

function showToggleBlockPropertiesButton(block_uuid) {
  // toggle block properties button
  logseq.provideUI({
    key: `tidy-blocks-properties-icon-${block_uuid}`,
    path: `div[id^="ls-block"][id$="${block_uuid}"`,
    template: 
    `<div class="tidy-blocks-properties" id="block-properties-container-${block_uuid}" data-on-click="toggle_block_properties" title="Hide/show block properties">
      <a class="button" id="block-properties-icon-${block_uuid}">${up_icon}</a>
    </div>`
  });

  logseq.provideStyle(`
    .tidy-blocks-properties {
      position: absolute;
      top: 0;
      right: -2.5em;
    }
    #block-properties-icon-${block_uuid} {
      display: flex;
      align-items: center;
      padding: 0.25em 0.375em;
    }
  `)

  // hide block properties
  setDriftlessTimeout(() => {
    parent.document.querySelector(`#block-content-${block_uuid} > .block-properties`).style.display = "none";
  }, 25);
}

function toggleBlockProperties(e) {
  parent_block_uuid = e.id.split("block-properties-container-")[1];
  
  block_properties = parent.document.getElementById(`tidy-block-properties-${parent_block_uuid}`);
  toggle_icon = parent.document.querySelector(`#block-properties-icon-${parent_block_uuid}`);

  if (block_properties.style.display == "none") {
    block_properties.style.display = "block";
    toggle_icon.innerHTML = down_icon;
  }
  else {
    block_properties.style.display = "none";
    toggle_icon.innerHTML = up_icon;
  }
}

function removeToggleBlockPropertiesButton() {
  all_blocks_with_buttons = parent.document.querySelectorAll(".tidy-blocks-properties");

  for (const block_with_buttons of all_blocks_with_buttons) {
    if (all_blocks_with_buttons) {
      button_block_uuid = block_with_buttons.id.split("block-properties-container-")[1];
      toggle_icon_container = parent.document.querySelector(`div[id*="tidy-blocks-properties-icon-${button_block_uuid}"]`);
      button_block_properties = parent.document.querySelector(`#block-content-${button_block_uuid} > .block-properties`);

      logseq.Editor.getBlockProperties(button_block_uuid).then(properties => {
        if (Object.keys(properties).length == 0) {
          toggle_icon_container.remove();
        }
        else {
          if (button_block_properties) {
            setDriftlessTimeout(() => {
              if (button_block_properties.id == "") {
                button_block_properties.id = `tidy-block-properties-${button_block_uuid}`;
                button_block_properties.style.display = "none";
              }
            }, 50);
          }
        }
      });
    }
  }
}

// remove toggle block button if the block has a button, but has no properties
const mutation_observer_buttons = new MutationObserver((changes) => {
  for (const change of changes) {
    removeToggleBlockPropertiesButton();
  }
});
mutation_observer_buttons.observe(parent.document.body, {
  childList: true,
  subtree: true
});
logseq.beforeunload(async () => {
  mutation_observer_buttons.disconnect();
});

const main = async () => {
  console.log("logseq-tidy-blocks-plugin loaded");

  logseq.provideModel ({
    toggle_block_properties(e) {
      toggleBlockProperties(e);
    }
  });

  // right click - tidy one block (keep a line break)
  logseq.Editor.registerBlockContextMenuItem("🧹 Tidy up & keep a line break", async (e) => {
    tidy_type = "keep a line break";
    tidySelectedBlock(e);
  });

  // slash command - tidy one block (keep a line break)
  logseq.Editor.registerSlashCommand("🧹 Tidy up & keep a line break", async (e) => {
    tidy_type = "keep a line break";
    tidySelectedBlock(e);
  });

  // right click - tidy one block (remove all whitespace)
  logseq.Editor.registerBlockContextMenuItem("🧹 Tidy up & remove all whitespace", async (e) => {
    tidy_type = "remove all whitespace";
    tidySelectedBlock(e);
  });

  // slash command - tidy one block (remove all whitespace)
  logseq.Editor.registerSlashCommand("🧹 Tidy up & remove all whitespace", async (e) => {
    tidy_type = "remove all whitespace";
    tidySelectedBlock(e);
  });

  // keyboard shortcut:  tidy block(s) and keep a line break
  logseq.App.registerCommandPalette({
    key: `tidy-blocks-KeyboardShortcut_LineBreak`,
    label: "Tidy up & keep a line break",
    keybinding: {
      binding: logseq.settings.KeyboardShortcut_LineBreak,
      mode: "global",
    }
  }, async (e) => {
    tidy_type = "keep a line break";
    tidyBlocks(e);
  });

  // keyboard shortcut: tidy block(s) and remove all linespaces
  logseq.App.registerCommandPalette({
    key: `tidy-blocks-KeyboardShortcut_RemoveAll`,
    label: "Tidy up & remove all whitespace",
    keybinding: {
      binding: logseq.settings.KeyboardShortcut_RemoveAll,
      mode: "global",
    }
  }, async (e) => {
    tidy_type = "remove all whitespace";
    tidyBlocks(e);
  });

  logseq.provideModel({
    show_settings() {
      logseq.showSettingsUI();
    }
  });

   // toolbar icon
   logseq.App.registerUIItem("toolbar", {
    key: "logseq-tidy-blocks",
    template:
      `<a data-on-click="show_settings" class="button">
        <svg style="width:22px; height:22px;" viewBox="0 0 24 24">
          <path fill="var(--ls-primary-text-color)" d="M19.36,2.72L20.78,4.14L15.06,9.85C16.13,11.39 16.28,13.24 15.38,14.44L9.06,8.12C10.26,7.22 12.11,7.37 13.65,8.44L19.36,2.72M5.93,17.57C3.92,15.56 2.69,13.16 2.35,10.92L7.23,8.83L14.67,16.27L12.58,21.15C10.34,20.81 7.94,19.58 5.93,17.57Z" />
        </svg>
      </a>`
  });
}

logseq.ready(main).catch(console.error);