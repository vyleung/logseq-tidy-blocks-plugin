import "@logseq/libs";

const settings = [
  {
    key: "keyboardShortcut",
    title: "Keyboard shortcut to tidy block(s)",
    description: "This is the the keyboard shortcut to tidy one block or multiple blocks (default: alt+t)",
    type: "string",
    default: "alt+t"
  }
]
logseq.useSettingsSchema(settings);

// ref for traversing through a block and their children: https://gist.github.com/umidjons/6865350#file-walk-dom-js
// ref for replacing extra spaces and tabs (1st .replace()): https://stackoverflow.com/questions/5310821/removing-space-and-retaining-the-new-line
// ref for replacing extra line breaks (2nd .replace()): https://stackoverflow.com/questions/22962220/remove-multiple-line-breaks-n-in-javascript
function tidy(block) {
  logseq.Editor.getBlock(block.uuid, {includeChildren: true}).then(tree_block => {
    let block_content = tree_block.content;
    logseq.Editor.updateBlock(tree_block.uuid, block_content.trim().replace(/[ \t]{2,}/gu, " ").replace(/[\r\n]{2,}/g, "\n"));

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
  logseq.App.showMsg("Block is tidied!");
}

// tidy multiple selected blocks
function tidyMultipleSelectedBlocks() {
  logseq.Editor.getSelectedBlocks().then(selected_blocks => {
    selected_blocks.forEach(selected_block => {
      tidy(selected_block);
    });
  });
  logseq.App.showMsg("Blocks are tidied!");
}

function tidyBlocks(e) {
  // if the uuid exists, one block has been selected; otherwise, multiple blocks have been selected
  (e.uuid) ? tidySelectedBlock(e) : tidyMultipleSelectedBlocks();
}

const main = async () => {
  console.log("logseq-tidy-blocks-plugin loaded");

  let keyboard_shortcut_version = 0;

  // register keyboard shortcut to tidy block(s)
  function registerKeyboardShortcut(type, version, keyboard_shortcut) {
      logseq.App.registerCommandPalette({
        key: `tidy-blocks-${type}-${version}`,
        label: "Tidy block(s)",
        keybinding: {
          binding: keyboard_shortcut,
          mode: "global",
        }
      }, async (e) => {
        tidyBlocks(e);
      });
  }

  // unregister keyboard shortcut to tidy block(s)
  function unregisterKeyboardShortcut(type, version) {
    logseq.App.unregister_plugin_simple_command(`${logseq.baseInfo.id}/tidy-blocks-${type}-${version}`);
    
    version++;
  }

  logseq.onSettingsChanged(updated_settings => {
    // register default keyboard shortcut
    if ((keyboard_shortcut_version == 0) && (updated_settings.keyboardShortcut != undefined)) {
      registerKeyboardShortcut("keyboardShortcut", keyboard_shortcut_version, updated_settings.keyboardShortcut);
      
      // keyboard_shortcut_version = 0 => 1;
      keyboard_shortcut_version++;
    }
    // when the keyboard shortcut is modified:
    else {
      // keyboard_shortcut_version = 1 => 0;
      keyboard_shortcut_version--;

      // unregister previous shortcut
      unregisterKeyboardShortcut("keyboardShortcut", keyboard_shortcut_version);
    }
  });

  // right click - tidy one block
  logseq.Editor.registerBlockContextMenuItem("🧹 Tidy up", async (e) => {
    tidySelectedBlock(e);
  });

  // slash command - tidy one block
  logseq.Editor.registerSlashCommand("🧹 Tidy up", async (e) => {
    tidySelectedBlock(e);
  });
}

logseq.ready(main).catch(console.error);