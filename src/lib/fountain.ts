import { BlockType, ScriptBlock } from '@/src/types';

/**
 * Parse a Fountain-formatted string into an array of ScriptBlocks.
 * This handles all Fountain syntax including scene headings, characters,
 * dialogue, transitions, parentheticals, and forced type prefixes.
 */
export const fountainToBlocks = (fountain: string): ScriptBlock[] => {
  if (!fountain || fountain.trim() === '') {
    return [{ id: 'block-' + Math.random().toString(36).substring(2, 9), type: 'action', content: '' }];
  }
  
  // Normalize newlines and split
  const lines = fountain.replace(/\r\n/g, '\n').split('\n');
  
  // Remove extra trailing newline if present to prevent growing vertical space
  if (lines.length > 0 && lines[lines.length - 1] === '' && fountain.endsWith('\n')) {
    lines.pop();
  }
  
  const result: ScriptBlock[] = [];

  lines.forEach((line, index) => {
    let type: BlockType = 'action';
    let content = line.trim();

    if (content === '') {
      result.push({ id: `block-${result.length}`, type: 'action', content: '' });
      return;
    }

    // Check for forced type prefixes
    if (content.startsWith('!')) {
      type = 'action';
      content = content.substring(1).trim();
    } 
    else if (content.startsWith('~')) {
      type = 'dialogue';
      content = content.substring(1).trim();
    }
    // 1. Scene Heading
    else if (content.startsWith('.') || /^(INT|EXT|INT\/EXT|INT\.\/EXT\.|I\/E|EST|SCENE|SHOT)([. ]|$)/i.test(content)) {
      type = 'scene';
      if (content.startsWith('.')) {
        content = content.substring(1).trim();
      }
    } 
    // 2. Transition
    else if (content.startsWith('>') || content.toUpperCase().endsWith(' TO:')) {
      type = 'transition';
      if (content.startsWith('>')) {
        content = content.substring(1).trim();
      }
    }
    // 3. Parenthetical
    else if (content.startsWith('(') && content.endsWith(')')) {
      type = 'parenthetical';
    }
    // 4. Character
    else if (content.startsWith('@')) {
      type = 'character';
      content = content.substring(1).trim();
    }
    else if (content === content.toUpperCase() && !/^\d+$/.test(content)) {
      type = 'character';
    }
    // 5. Dialogue
    else {
      // Look back for character, dialogue continuation
      let j = result.length - 1;
      if (j >= 0) {
        const prev = result[j];
        // Dialogue MUST stay dialogue if it follows character, parenthetical OR another dialogue
        // BUT only if there was no empty line (our splitter keeps empty lines as blocks)
        if ((prev.type === 'character' || prev.type === 'parenthetical' || prev.type === 'dialogue') && prev.content.trim() !== '') {
          type = 'dialogue';
        }
      }
    }

    result.push({ id: `block-${result.length}`, type, content });
  });

  return result;
};

/**
 * Serialize an array of ScriptBlocks back into Fountain-formatted text.
 * This adds forced-type prefixes (!, ~, ., >, @) when a block's type
 * wouldn't be correctly inferred from its content alone.
 */
export const blocksToFountain = (blocks: ScriptBlock[]): string => {
  return blocks.map((block, index) => {
    const content = block.content;
    const trimmed = content.trim();

    if (trimmed === '') return content;
    
    // If it is forced type but wouldn't be detected as such, add prefix
    if (block.type === 'character' && !trimmed.startsWith('@')) {
      const isUppercase = trimmed === trimmed.toUpperCase() && !/^\d+$/.test(trimmed);
      if (!isUppercase) return '@' + content;
    }
    
    if (block.type === 'scene' && !trimmed.startsWith('.') && !/^(INT|EXT|INT\/EXT|INT\.\/EXT\.|I\/E|EST|SCENE|SHOT)([. ]|$)/i.test(trimmed)) {
      return '.' + content;
    }
    
    if (block.type === 'transition' && !trimmed.startsWith('>') && !trimmed.toUpperCase().endsWith(' TO:')) {
      return '>' + content;
    }

    if (block.type === 'dialogue') {
      const isForcedDialogue = trimmed.startsWith('~');
      if (isForcedDialogue) return content;

      // Check if it would be misparsed as action
      let followsCharacter = false;
      if (index > 0) {
        const prev = blocks[index-1];
        if ((prev.type === 'character' || prev.type === 'parenthetical' || prev.type === 'dialogue') && prev.content.trim() !== '') {
          followsCharacter = true;
        }
      }

      if (!followsCharacter) {
        return '~' + content;
      }
    }

    if (block.type === 'action') {
      const isForcedAction = trimmed.startsWith('!');
      if (isForcedAction) return content;

      // Check if it would be misparsed as dialogue. 
      // In Fountain, any indented line OR non-uppercase line following a character/parenthetical/dialogue 
      // WITHOUT an empty line between is dialogue.
      let wouldBeDialogue = false;
      if (index > 0) {
        const prev = blocks[index-1];
        // If the previous block was character-related AND not empty
        if ((prev.type === 'character' || prev.type === 'parenthetical' || prev.type === 'dialogue') && prev.content.trim() !== '') {
          wouldBeDialogue = true;
        }
      }

      const wouldBeScene = trimmed.startsWith('.') || /^(INT|EXT|INT\/EXT|INT\.\/EXT\.|I\/E|EST|SCENE|SHOT)([. ]|$)/i.test(trimmed);
      const wouldBeTransition = trimmed.startsWith('>') || trimmed.toUpperCase().endsWith(' TO:');
      const wouldBeCharacter = trimmed.startsWith('@') || (trimmed === trimmed.toUpperCase() && trimmed.length > 0 && !/^\d+$/.test(trimmed));
      const wouldBeParenthetical = trimmed.startsWith('(') && trimmed.endsWith(')');

      if (wouldBeDialogue || wouldBeScene || wouldBeTransition || wouldBeCharacter || wouldBeParenthetical) {
        return '!' + content;
      }
    }
    
    return content;
  }).join('\n');
};
