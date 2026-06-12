'use client';

import { useEffect, useRef, useState } from 'react';
import type { DrawingDocument } from '../../types/canvas';
import { parseYaml } from '../../lib/yaml/parse';
import { serializeToYaml } from '../../lib/yaml/serialize';

interface Props {
  document: DrawingDocument;
  // Called when valid YAML has been parsed and the document should update.
  onDocumentChange: (doc: DrawingDocument) => void;
}

export default function YamlEditor({ document: doc, onDocumentChange }: Props) {
  const [text, setText] = useState(() => serializeToYaml(doc));
  const [error, setError] = useState<string | null>(null);

  // Tracks whether the textarea currently has focus so we avoid overwriting
  // the user's in-progress edits when the canvas updates the document.
  const focusedRef = useRef(false);
  // Tracks whether the last document update was triggered by this editor so
  // we don't re-serialize back and clobber cursor position.
  const fromYamlRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep textarea in sync when the document changes externally (e.g. drawing tools).
  useEffect(() => {
    if (focusedRef.current || fromYamlRef.current) {
      fromYamlRef.current = false;
      return;
    }
    setText(serializeToYaml(doc));
    setError(null);
  }, [doc]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const result = parseYaml(value, doc);
      if (result.error !== null) {
        setError(result.error);
      } else {
        fromYamlRef.current = true;
        onDocumentChange(result.document);
      }
    }, 400);
  }

  function handleBlur() {
    focusedRef.current = false;
    // On blur, re-sync to canonical doc if no active edit is pending.
    if (!debounceRef.current) setText(serializeToYaml(doc));
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <textarea
        className="flex-1 resize-none font-mono text-xs leading-5 p-3 outline-none text-zinc-800 bg-zinc-50 border-0"
        value={text}
        onChange={handleChange}
        onFocus={() => { focusedRef.current = true; }}
        onBlur={handleBlur}
        spellCheck={false}
        aria-label="YAML drawing source"
      />
      {error && (
        <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200 font-mono whitespace-pre-wrap">
          {error}
        </div>
      )}
    </div>
  );
}
