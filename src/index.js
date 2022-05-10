import "@logseq/libs";

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
  }
]
logseq.useSettingsSchema(settings);
let tidy_type;

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

const main = async () => {
  console.log("logseq-tidy-blocks-plugin loaded");

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
}

logseq.ready(main).catch(console.error);