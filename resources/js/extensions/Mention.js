import { Mention as mention } from "@tiptap/extension-mention";
import tippy from "tippy.js";

export const Mention = mention.configure({
    HTMLAttributes: {
        class: 'font-bold',
    },
    
    suggestion: {
        items: ({ query }) => this.options.mentions.filter(item => item.toLowerCase().startsWith(query.toLowerCase())),
        render: () => {
            let component
            let popup
            
            return {
                onStart: (props) => {
                    if (!props.clientRect) {
                        return;
                    }
                    
                    const html = `
                                <div
                                    x-data="{

                                        items: ['${props.items.join('\', \'')}'],

                                        selectedIndex: 0,

                                        init: function () {
                                            this.$el.parentElement.addEventListener('mentions-key-down', (event) => this.onKeyDown(event.detail));
                                            this.$el.parentElement.addEventListener('mentions-update-items', (event) => this.items = event.detail);
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
                                    class="p-1 relative rounded bg-white text-gray-950 overflow-hidden text-sm shadow-md"
                                >
                                    <template x-if="items.length">
                                        <template x-for="(item, index) in items" :key="index">
                                            <button
                                                x-text="item"
                                                x-on:click="selectItem(index)"
                                                class="block w-full text-left rounded border p-1"
                                                :class="index === selectedIndex ? 'border-gray-950' : 'border-transparent'"
                                            ></button>
                                        </template>
                                    </template>
                                    <template x-if="!items.length">
                                        <div class="block w-full text-left bg-transparent rounded border border-transparent p-2">
                                            No result
                                        </div>
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
                    component.dispatchEvent(new CustomEvent('mentions-update-items', { detail: props.items }));
                },
                
                onKeyDown(props) {
                    if (props.event.key === 'Escape') {
                        popup[0].hide();
                        
                        return true;
                    }
                    
                    component.dispatchEvent(new CustomEvent('mentions-key-down', { detail: props.event }));
                },
                
                onExit() {
                    popup[0].destroy();
                },
            }
        },
    },
});
