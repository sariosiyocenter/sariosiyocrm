import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Bold, Italic, Underline as UnderlineIcon, Subscript as SubIcon, Superscript as SupIcon, List, ListOrdered } from 'lucide-react';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
}

const MenuButton = ({ onClick, isActive, children, title }: any) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className={`p-2 rounded-lg transition-all ${
            isActive 
            ? 'bg-teal-600 text-white shadow-lg' 
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
    >
        {children}
    </button>
);

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Subscript,
            Superscript,
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    if (!editor) return null;

    return (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden bg-gray-50/30 dark:bg-gray-900/30 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10 transition-all">
            <div className="flex items-center gap-1 p-2 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                <MenuButton 
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    title="Bold"
                >
                    <Bold size={18} />
                </MenuButton>
                <MenuButton 
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    title="Italic"
                >
                    <Italic size={18} />
                </MenuButton>
                <MenuButton 
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive('underline')}
                    title="Underline"
                >
                    <UnderlineIcon size={18} />
                </MenuButton>
                
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                <MenuButton 
                    onClick={() => editor.chain().focus().toggleSubscript().run()}
                    isActive={editor.isActive('subscript')}
                    title="Subscript"
                >
                    <SubIcon size={18} />
                </MenuButton>
                <MenuButton 
                    onClick={() => editor.chain().focus().toggleSuperscript().run()}
                    isActive={editor.isActive('superscript')}
                    title="Superscript"
                >
                    <SupIcon size={18} />
                </MenuButton>

                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                <MenuButton 
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    title="Bullet List"
                >
                    <List size={18} />
                </MenuButton>
                <MenuButton 
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    title="Ordered List"
                >
                    <ListOrdered size={18} />
                </MenuButton>
            </div>
            <div className="p-4 min-h-[150px] cursor-text bg-white dark:bg-gray-800/50 prose dark:prose-invert max-w-none">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
