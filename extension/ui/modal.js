class BananaModal {
    constructor(site) {
        this.site = site;
        this.modal = null;
        this.store = null;
        this.searchComponent = null;
        this.paginationComponent = null;
        this.announcementComponent = null;
        this.promptForm = null;

        this.keyboardHandler = this.handleKeyboard.bind(this);
        this._isInitialized = false;
        this._unsubscribe = null;
    }

    isMobile() {
        return window.innerWidth <= 768;
    }

    async init() {
        if (this._isInitialized) return;

        // Initialize Store
        this.store = new Store();
        await this.store.init();

        // Subscribe to store changes
        this._unsubscribe = this.store.subscribe(() => {
            this.onStoreChange();
        });

        this._isInitialized = true;
    }

    async show() {
        if (!this._isInitialized) {
            await this.init();
        }

        if (!this.modal) {
            this.modal = this.createModal();
            document.body.appendChild(this.modal);
        }

        this.modal.style.display = 'flex';

        // Load announcement
        if (this.announcementComponent) {
            await this.announcementComponent.load();
        }

        // Set total items for pagination
        const filteredPrompts = this.store.getFilteredPrompts();
        this.paginationComponent.setTotalItems(filteredPrompts.length);

        // Render initial view
        this.renderCards();

        // Add keyboard listener
        document.addEventListener('keydown', this.keyboardHandler);
    }

    hide() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }

        // Cleanup
        if (this.paginationComponent) {
            this.paginationComponent.cleanup();
        }

        document.removeEventListener('keydown', this.keyboardHandler);
    }

    createModal() {
        const { h } = window.DOM;
        const colors = this.site.getThemeColors();
        const mobile = this.isMobile();

        const overlay = h('div', {
            id: 'prompts-modal',
            style: 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 1000;',
            onclick: (e) => {
                if (e.target === overlay) this.hide();
            }
        });

        const container = h('div', {
            style: `background: ${colors.background}; border-radius: ${mobile ? '24px 24px 0 0' : '20px'}; box-shadow: 0 20px 60px ${colors.shadow}; max-width: ${mobile ? '100%' : '900px'}; width: ${mobile ? '100%' : '90%'}; max-height: ${mobile ? '90vh' : '85vh'}; display: flex; flex-direction: column; ${mobile ? 'margin-top: auto;' : ''}; overflow: visible;`
        });

        // Search Section
        const searchSection = this.createSearchSection();

        // Content Section
        const contentSection = this.createContentSection();

        // Pagination Section
        const paginationSection = this.createPaginationSection();

        container.appendChild(searchSection);
        container.appendChild(contentSection);
        container.appendChild(paginationSection);

        overlay.appendChild(container);

        // Mobile touch to close
        if (mobile) {
            overlay.addEventListener('touchstart', (e) => {
                if (e.target === overlay) this.hide();
            });
        }

        return overlay;
    }

    createSearchSection() {
        const colors = this.site.getThemeColors();
        const mobile = this.isMobile();

        this.searchComponent = new window.UI.Search({
            colors,
            isMobile: mobile,
            categories: this.store.state.categories,
            selectedCategory: this.store.state.selectedCategory,
            activeFilters: this.store.state.activeFilters,
            sortMode: this.store.state.sortMode,
            nsfwEnabled: this.store.state.nsfwEnabled,
            onSearch: (keyword) => {
                this.store.setSearchKeyword(keyword);
                this.paginationComponent.resetPage();
            },
            onCategoryChange: (category) => {
                this.store.setCategory(category);
                this.paginationComponent.resetPage();
            },
            onFilterChange: (filters) => {
                this.store.setFilters(filters);
                this.paginationComponent.resetPage();
            },
            onSortChange: async (mode) => {
                await this.store.setSortMode(mode);
                this.paginationComponent.resetPage();
            },
            onNsfwChange: async (enabled) => {
                await this.store.setNsfwEnabled(enabled);
                this.paginationComponent.resetPage();
            },
            onRecentWeekChange: (enabled) => {
                this.store.setRecentWeekEnabled(enabled);
                this.paginationComponent.resetPage();
            },
            onAddPrompt: () => {
                this.showPromptForm();
            }
        });

        return this.searchComponent.render();
    }

    createContentSection() {
        const { h } = window.DOM;
        const mobile = this.isMobile();

        const scrollArea = h('div', {
            id: 'prompts-scroll-area',
            style: `flex: 1; overflow-y: auto; padding: ${mobile ? '16px' : '20px 24px'}; -webkit-overflow-scrolling: touch;`
        });

        const grid = h('div', {
            id: 'prompts-grid',
            style: `display: grid; grid-template-columns: ${mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)'}; gap: ${mobile ? '12px' : '16px'};`
        });

        scrollArea.appendChild(grid);

        return scrollArea;
    }

    createPaginationSection() {
        const colors = this.site.getThemeColors();
        const mobile = this.isMobile();

        this.paginationComponent = new window.UI.Pagination({
            colors,
            mobile,
            onPageChange: () => {
                this.renderCards();
            }
        });

        const paginationElement = this.paginationComponent.render();

        // Add announcement component
        this.announcementComponent = new window.UI.Announcement(colors, mobile);
        const announcementElement = this.announcementComponent.render();

        const announcementContainer = paginationElement.querySelector('#pagination-announcement');
        if (announcementContainer) {
            announcementContainer.appendChild(announcementElement);
        }

        return paginationElement;
    }

    onStoreChange() {
        const filteredPrompts = this.store.getFilteredPrompts();
        this.paginationComponent.setTotalItems(filteredPrompts.length);
        this.renderCards();

        // Update search component if categories changed
        if (this.searchComponent) {
            this.searchComponent.props.categories = this.store.state.categories;
            this.searchComponent.renderCategoryOptions();
        }
    }

    renderCards() {
        const grid = document.getElementById('prompts-grid');
        if (!grid) return;

        const filteredPrompts = this.store.getFilteredPrompts();
        const { currentPage, pageSize } = this.paginationComponent;

        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageItems = filteredPrompts.slice(start, end);

        grid.innerHTML = '';

        const colors = this.site.getThemeColors();
        const theme = this.site.getCurrentTheme();
        const mobile = this.isMobile();

        if (pageItems.length === 0) {
            this.renderEmptyPlaceholder(grid);
        } else {
            pageItems.forEach(prompt => {
                const card = window.UI.Card.create(prompt, {
                    favorites: this.store.state.favorites,
                    theme,
                    colors,
                    mobile,
                    onInsert: (prompt) => this.site.insertPrompt(prompt),
                    onToggleFavorite: async (promptId) => {
                        await this.store.toggleFavorite(promptId);
                        this.renderCards(); // Re-render to update star
                    },
                    onEdit: (prompt) => this.showPromptForm(prompt),
                    onDelete: async (id) => {
                        await this.store.deleteCustomPrompt(id);
                    }
                });
                grid.appendChild(card);
            });

            // Fill with empty placeholders
            if (pageItems.length < pageSize) {
                this.fillEmptyPlaceholders(grid, pageSize - pageItems.length);
            }
        }

        // Scroll to top
        const scrollArea = document.getElementById('prompts-scroll-area');
        if (scrollArea) scrollArea.scrollTop = 0;
    }

    renderEmptyPlaceholder(grid) {
        const { h } = window.DOM;
        const colors = this.site.getThemeColors();
        const mobile = this.isMobile();

        const columns = mobile ? 2 : 4;
        const rows = Math.ceil(this.paginationComponent.pageSize / columns);
        const cardMinHeight = mobile ? 240 : 260;
        const gap = mobile ? 12 : 16;
        const minHeight = rows * cardMinHeight + (rows - 1) * gap;

        const placeholder = h('div', {
            style: `
                grid-column: 1 / -1;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: ${minHeight}px;
                color: ${colors.textSecondary};
                font-size: ${mobile ? '14px' : '16px'};
            `
        }, '没有找到相关提示词');

        grid.appendChild(placeholder);
    }

    fillEmptyPlaceholders(grid, count) {
        const { h } = window.DOM;
        const mobile = this.isMobile();
        const cardMinHeight = mobile ? 240 : 260;

        for (let i = 0; i < count; i++) {
            const placeholder = h('div', {
                style: `
                    min-height: ${cardMinHeight}px;
                    opacity: 0;
                    pointer-events: none;
                `
            });
            grid.appendChild(placeholder);
        }
    }

    showPromptForm(existingPrompt = null) {
        const colors = this.site.getThemeColors();
        const mobile = this.isMobile();

        this.promptForm = new window.UI.PromptForm({
            categories: this.store.state.categories,
            colors,
            mobile,
            onSave: async (promptData, existing) => {
                if (existing) {
                    // Update
                    const updatedPrompt = {
                        ...existing,
                        ...promptData,
                        isCustom: true,
                        author: 'Me'
                    };
                    await this.store.updateCustomPrompt(updatedPrompt);
                } else {
                    // Add new
                    const newPrompt = {
                        ...promptData,
                        id: `custom-${Date.now()}`,
                        isCustom: true,
                        author: 'Me'
                    };
                    await this.store.addCustomPrompt(newPrompt);
                }
            },
            onCancel: () => {
                this.promptForm = null;
            }
        });

        this.promptForm.show(existingPrompt);
    }

    handleKeyboard(event) {
        // Check if modal is visible
        if (!this.modal || this.modal.style.display === 'none') {
            return;
        }

        // Don't trigger if focus is in input
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        )) {
            return;
        }

        const totalPages = this.paginationComponent.getTotalPages();
        if (totalPages <= 1) return;

        // Handle Arrow Keys
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            if (this.paginationComponent.currentPage > 1) {
                this.paginationComponent.changePage(-1);
            }
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            if (this.paginationComponent.currentPage < totalPages) {
                this.paginationComponent.changePage(1);
            }
        }
    }

    destroy() {
        this.hide();

        if (this._unsubscribe) {
            this._unsubscribe();
        }

        if (this.searchComponent) {
            this.searchComponent.destroy();
        }

        if (this.paginationComponent) {
            this.paginationComponent.cleanup();
        }

        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }

        this.modal = null;
        this._isInitialized = false;
    }
}
