import { mergeAttributes, Node } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import tippy from 'tippy.js'

export const MentionPluginKey = new PluginKey('mention')

export const Mention = Node.create({
    name: 'mention',
    
    group: 'inline',
    
    inline: true,
    
    selectable: false,
    
    atom: true,
    
    addOptions() {
        return {
            HTMLAttributes: {
                class: 'font-bold',
            },
            renderText({ options, node }) {
                return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`
            },
            renderHTML({ options, node }) {
                return [
                    'span',
                    this.HTMLAttributes,
                    `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`,
                ]
            },
            suggestion: {
                char: '@',
                pluginKey: MentionPluginKey,
                command: ({ editor, range, props }) => {
                    // increase range.to by one when the next node is of type "text"
                    // and starts with a space character
                    const nodeAfter = editor.view.state.selection.$to.nodeAfter
                    const overrideSpace = nodeAfter?.text?.startsWith(' ')
                    
                    if (overrideSpace) {
                        range.to += 1
                    }
                    
                    editor
                        .chain()
                        .focus()
                        .insertContentAt(range, [
                            {
                                type: this.name,
                                attrs: props,
                            },
                            {
                                type: 'text',
                                text: ' ',
                            },
                        ])
                        .run()
                    
                    window.getSelection()?.collapseToEnd()
                },
                allow: ({ state, range }) => {
                    const $from = state.doc.resolve(range.from)
                    const type = state.schema.nodes[this.name]
                    
                    return !!$from.parent.type.contentMatch.matchType(type)
                },
            },
        }
    },
    
    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-id'),
                renderHTML: attributes => {
                    if (!attributes.id) {
                        return {}
                    }
                    
                    return {
                        'data-id': attributes.id,
                    }
                },
            },
            
            label: {
                default: null,
                parseHTML: element => element.getAttribute('data-label'),
                renderHTML: attributes => {
                    if (!attributes.label) {
                        return {}
                    }
                    
                    return {
                        'data-label': attributes.label,
                    }
                },
            },
        }
    },
    
    parseHTML() {
        return [
            {
                tag: `span[data-type='${this.name}']`
            }
        ]
    },
    
    renderHTML({ node, HTMLAttributes }) {
        if (this.options.renderLabel !== undefined) {
            console.warn('renderLabel is deprecated use renderText and renderHTML instead')
            return [
                'span',
                mergeAttributes({ 'data-type': this.name }, this.options.HTMLAttributes, HTMLAttributes),
                this.options.renderLabel({
                    options: this.options,
                    node,
                }),
            ]
        }
        const html = this.options.renderHTML({
            options: this.options,
            node,
        })
        
        return [
            typeof html === 'string' ? 'span' : html[0],
            mergeAttributes({ 'data-type': this.name }, this.options.HTMLAttributes, HTMLAttributes),
            typeof html === 'string' ? html : html[2],
        ]
    },
    
    renderText({ node }) {
        if (this.options.renderLabel !== undefined) {
            console.warn('renderLabel is deprecated use renderText and renderHTML instead')
            return this.options.renderLabel({
                options: this.options,
                node,
            })
        }
        return this.options.renderText({
            options: this.options,
            node,
        })
    },
    
    addKeyboardShortcuts() {
        return {
            Backspace: () => this.editor.commands.command(({ tr, state }) => {
                let isMention = false
                const { selection } = state
                const { empty, anchor } = selection
                
                if (!empty) {
                    return false
                }
                
                state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
                    if (node.type.name === this.name) {
                        isMention = true
                        tr.insertText(this.options.suggestion.char || '', pos, pos + node.nodeSize)
                        
                        return false
                    }
                })
                
                return isMention
            }),
        }
    },
    
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                char: '@',
                items: ({ query }) => this.options.mentions.filter(item => item.toLowerCase().startsWith(query.toLowerCase())),
                pluginKey: MentionPluginKey,
                command: ({ editor, range, props }) => {
                    const nodeAfter = editor.view.state.selection.$to.nodeAfter
                    const overrideSpace = nodeAfter?.text?.startsWith(' ')
                    
                    if (overrideSpace) {
                        range.to += 1
                    }
                    
                    editor
                        .chain()
                        .focus()
                        .insertContentAt(range, [
                            {
                                type: this.name,
                                attrs: props
                            },
                            {
                                type: 'text',
                                text: ' '
                            },
                        ])
                        .run()
                    
                    window.getSelection()?.collapseToEnd()
                },
                allow: ({ state, range }) => {
                    const $from = state.doc.resolve(range.from)
                    const type = state.schema.nodes[this.name]
                    return !!$from.parent.type.contentMatch.matchType(type)
                },
                render: () => {
                    let component
                    let popup
                    
                    return {
                        onStart: (props) => {
                            if (!props.clientRect) {
                                return
                            }
                            
                            const html = `
                                <div
                                    x-data="{
                                        items: ['${props.items.join('\', \'')}'],
                                        selectedIndex: 0,
                                        init: function () {
                                            this.$el.parentElement.addEventListener('mentions-key-down', (event) => this.onKeyDown(event.detail));
                                            this.$el.parentElement.addEventListener('mentions-update-items', (event) => (items = event.detail));
                                        },
                                        onKeyDown: function (event) {
                                            if (event.key === 'ArrowUp') {
                                                event.preventDefault();
                                                this.selectedIndex = ((this.selectedIndex + this.items.length) - 1) % this.items.length;
                                                return true;
                                            };
                                            if (event.key === 'ArrowDown') {
                                                event.preventDefault();
                                                this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
                                                return true;
                                            };
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                this.selectItem(this.selectedIndex);
                                                return true;
                                            };
                                            return false;
                                        },
                                        selectItem: function (index) {
                                            const item = this.items[index];
                                            if (! item) {
                                                return;
                                            };
                                            $el.parentElement.dispatchEvent(new CustomEvent('mentions-select', { detail: { item } }));
                                        },
                                    }"
                                    class="tippy-content-p-0"
                                >
                                    <template x-for="(item, index) in items" :key="index">
                                        <button
                                            x-text="item"
                                            x-on:click="selectItem(index)"
                                            :class="{ 'bg-primary-500': index === selectedIndex }"
                                            class="block w-full text-left rounded px-2 py-1"
                                        ></button>
                                    </template>
                                </div>
                            `
                            
                            component = document.createElement('div');
                            component.innerHTML = html;
                            component.addEventListener('mentions-select', (event) => {
                                props.command({ id: event.detail.item });
                            });
                            
                            popup = tippy('body', {
                                getReferenceClientRect: props.clientRect,
                                appendTo: () => document.body,
                                content: component,
                                allowHTML: true,
                                showOnCreate: true,
                                interactive: true,
                                trigger: 'manual',
                                placement: 'bottom-start',
                            });
                        },
                        
                        onUpdate(props) {
                            if (!props.items.length) {
                                popup[0].hide();
                                
                                return;
                            }
                            
                            popup[0].show();
                            
                            component.dispatchEvent(new CustomEvent('mentions-update-items', { detail: props.items }));
                        },
                        
                        onKeyDown(props) {
                            component.dispatchEvent(new CustomEvent('mentions-key-down', { detail: props.event }));
                        },
                        
                        onExit() {
                            popup[0].destroy();
                        },
                    }
                },
            })
        ]
    }
})
