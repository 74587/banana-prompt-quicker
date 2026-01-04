window.UI = window.UI || {};

window.UI.PromptForm = class PromptForm {
    constructor(options = {}) {
        this.categories = options.categories || new Set();
        this.colors = options.colors;
        this.mobile = options.mobile || false;
        this.onSave = options.onSave;
        this.onCancel = options.onCancel;

        this.state = {
            selectedCategory: '',
            selectedMode: 'generate',
            selectedFile: null,
            previewUrl: '',
            referenceImages: []
        };

        this.overlay = null;
        this.cleanupFns = [];
    }

    show(existingPrompt = null) {
        const { h } = window.DOM;
        const { colors, mobile } = this;

        // Initialize state
        const addCategories = Array.from(this.categories)
            .filter(c => c !== '全部')
            .sort((a, b) => a.localeCompare(b));

        this.state.selectedCategory = existingPrompt?.category || addCategories[0];
        this.state.selectedMode = existingPrompt?.mode || 'generate';
        this.state.selectedFile = null;
        this.state.previewUrl = existingPrompt?.preview || '';
        this.state.referenceImages = existingPrompt?.referenceImages || [];

        // Create overlay
        this.overlay = h('div', {
            style: 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1100;',
            onclick: (e) => {
                if (e.target === this.overlay) this.close();
            }
        });

        // Create dialog
        const dialog = h('div', {
            style: `background: ${colors.surface}; padding: ${mobile ? '24px' : '32px'}; border-radius: 20px; width: ${mobile ? '90%' : '480px'}; max-width: 90%; box-shadow: 0 20px 60px ${colors.shadow}; display: flex; flex-direction: column; gap: 16px; color: ${colors.text};`
        });

        // Title
        const title = h('h3', {
            style: 'margin: 0 0 4px 0; font-size: 20px; font-weight: 600;'
        }, existingPrompt ? '编辑自定义 Prompt' : '添加自定义 Prompt');

        // Title Input
        const titleInput = this.createInput('标题');
        if (existingPrompt) titleInput.value = existingPrompt.title;

        // Mode Selection (Moved up)
        const modeContainer = this.createModeSelection();

        // Image Upload (Preview)
        const imageContainer = this.createImageUpload(existingPrompt);

        // Reference Images Upload
        const refImagesContainer = this.createReferenceImagesUpload();

        // Category & Sub-Category Row
        const categoryRow = h('div', {
            style: 'display: flex; gap: 12px; align-items: flex-start;'
        });

        // Category Dropdown
        const categoryContainer = this.createCategoryDropdown(addCategories);
        categoryContainer.style.flex = '1';

        // Sub-Category Input
        const subCategoryInput = this.createInput('子分类 (可选)');
        subCategoryInput.style.flex = '1';
        if (existingPrompt?.sub_category) subCategoryInput.value = existingPrompt.sub_category;

        categoryRow.appendChild(categoryContainer);
        categoryRow.appendChild(subCategoryInput);

        // Prompt Content
        const promptInput = this.createInput('Prompt 内容', true);
        if (existingPrompt) promptInput.value = existingPrompt.prompt;

        // Buttons
        const btnContainer = this.createButtons(
            existingPrompt,
            titleInput,
            promptInput,
            subCategoryInput
        );

        dialog.appendChild(title);
        dialog.appendChild(titleInput);
        dialog.appendChild(modeContainer); // Mode is now here
        dialog.appendChild(imageContainer);
        dialog.appendChild(refImagesContainer);
        dialog.appendChild(categoryRow);   // Grouped row
        dialog.appendChild(promptInput);
        dialog.appendChild(btnContainer);

        this.overlay.appendChild(dialog);
        document.body.appendChild(this.overlay);
    }

    createInput(placeholder, isTextarea = false) {
        const { h } = window.DOM;
        const { colors, mobile } = this;

        const input = h(isTextarea ? 'textarea' : 'input', {
            placeholder,
            style: `width: 100%; padding: ${mobile ? '14px 16px' : '12px 16px'}; border: 1px solid ${colors.inputBorder}; border-radius: 12px; background: ${colors.inputBg}; color: ${colors.text}; font-size: 14px; outline: none; box-sizing: border-box; transition: all 0.2s; ${isTextarea ? 'min-height: 120px; resize: vertical; font-family: inherit;' : ''}`,
            onfocus: (e) => {
                e.target.style.borderColor = colors.primary;
                e.target.style.boxShadow = `0 0 0 3px ${colors.primary}15`;
            },
            onblur: (e) => {
                e.target.style.borderColor = colors.inputBorder;
                e.target.style.boxShadow = 'none';
            }
        });

        return input;
    }

    createImageUpload(existingPrompt) {
        const { h } = window.DOM;
        const { colors } = this;

        const imageContainer = h('div', {
            style: `width: 100%; height: 140px; border: 1px dashed ${colors.border}; border-radius: 12px; background: ${colors.inputBg}; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; transition: all 0.2s;`,
            onmouseenter: (e) => {
                if (!this.state.selectedFile && !this.state.previewUrl) {
                    e.target.style.borderColor = colors.primary;
                    e.target.style.background = colors.surfaceHover;
                }
            },
            onmouseleave: (e) => {
                if (!this.state.selectedFile && !this.state.previewUrl) {
                    e.target.style.borderColor = colors.border;
                    e.target.style.background = colors.inputBg;
                }
            }
        });

        const fileInput = h('input', {
            type: 'file',
            accept: 'image/*',
            style: 'display: none;'
        });

        // Placeholder Content
        const placeholderIcon = h('div', {
            innerHTML: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${colors.textSecondary}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
            style: 'margin-bottom: 8px;'
        });

        const placeholderText = h('span', {
            style: `font-size: 13px; color: ${colors.textSecondary}; font-weight: 500;`
        }, '点击上传封面图');

        const placeholderContainer = h('div', {
            style: 'display: flex; flex-direction: column; align-items: center; pointer-events: none;'
        }, [placeholderIcon, placeholderText]);

        // Preview Image
        const previewImg = h('img', {
            style: 'width: 100%; height: 100%; object-fit: cover; display: none; position: absolute; top: 0; left: 0;'
        });

        // Clear Button
        const clearBtn = h('button', {
            innerHTML: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
            style: `position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.5); color: white; border: none; cursor: pointer; display: none; align-items: center; justify-content: center; backdrop-filter: blur(4px); transition: all 0.2s; z-index: 10;`,
            onclick: (e) => {
                e.stopPropagation();
                fileInput.value = '';
                this.state.selectedFile = null;
                this.state.previewUrl = '';
                previewImg.src = '';
                previewImg.style.display = 'none';
                placeholderContainer.style.display = 'flex';
                clearBtn.style.display = 'none';
                imageContainer.style.borderStyle = 'dashed';
            },
            onmouseenter: (e) => e.target.style.background = 'rgba(0,0,0,0.7)',
            onmouseleave: (e) => e.target.style.background = 'rgba(0,0,0,0.5)'
        });

        // Click handler for container
        imageContainer.onclick = (e) => {
            if (e.target !== clearBtn && !clearBtn.contains(e.target)) {
                fileInput.click();
            }
        };

        // Load existing preview
        if (existingPrompt?.preview && !existingPrompt.preview.includes('gstatic.com')) {
            previewImg.src = existingPrompt.preview;
            previewImg.style.display = 'block';
            placeholderContainer.style.display = 'none';
            imageContainer.style.borderStyle = 'solid';
            clearBtn.style.display = 'flex';
            this.state.previewUrl = existingPrompt.preview;
        }

        fileInput.onchange = (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                this.state.selectedFile = file;

                const reader = new FileReader();
                reader.onload = (evt) => {
                    previewImg.src = evt.target.result;
                    previewImg.style.display = 'block';
                    placeholderContainer.style.display = 'none';
                    imageContainer.style.borderStyle = 'solid';
                    clearBtn.style.display = 'flex';
                };
                reader.readAsDataURL(file);
            }
        };

        imageContainer.appendChild(fileInput);
        imageContainer.appendChild(placeholderContainer);
        imageContainer.appendChild(previewImg);
        imageContainer.appendChild(clearBtn);

        return imageContainer;
    }

    createReferenceImagesUpload() {
        const { h } = window.DOM;
        const { colors } = this;

        const container = h('div', {
            style: 'display: flex; flex-direction: column; gap: 8px;'
        });

        const header = h('div', {
            style: 'display: flex; justify-content: space-between; align-items: center;'
        });

        const label = h('span', {
            style: `font-size: 14px; font-weight: 500; color: ${colors.text};`
        }, '参考图 (可选, 最多4张)');

        const countLabel = h('span', {
            style: `font-size: 12px; color: ${colors.textSecondary};`
        }, `${this.state.referenceImages.length}/4`);

        header.appendChild(label);
        header.appendChild(countLabel);

        const listContainer = h('div', {
            style: 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;'
        });

        const updateList = () => {
            listContainer.innerHTML = '';
            countLabel.textContent = `${this.state.referenceImages.length}/4`;

            // Render existing images
            this.state.referenceImages.forEach((imgData, index) => {
                const item = h('div', {
                    style: `position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid ${colors.border};`
                });

                const img = h('img', {
                    src: imgData,
                    style: 'width: 100%; height: 100%; object-fit: cover;'
                });

                const removeBtn = h('button', {
                    innerHTML: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
                    style: 'position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.6); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;',
                    onclick: () => {
                        this.state.referenceImages.splice(index, 1);
                        updateList();
                    }
                });

                item.appendChild(img);
                item.appendChild(removeBtn);
                listContainer.appendChild(item);
            });

            // Add button (if less than 4)
            if (this.state.referenceImages.length < 4) {
                const addBtn = h('div', {
                    style: `aspect-ratio: 1; border: 1px dashed ${colors.border}; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; background: ${colors.inputBg}; transition: all 0.2s;`,
                    onmouseenter: (e) => {
                        e.target.style.borderColor = colors.primary;
                        e.target.style.background = colors.surfaceHover;
                    },
                    onmouseleave: (e) => {
                        e.target.style.borderColor = colors.border;
                        e.target.style.background = colors.inputBg;
                    },
                    onclick: () => fileInput.click()
                });

                const icon = h('div', {
                    innerHTML: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${colors.textSecondary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
                });

                addBtn.appendChild(icon);
                listContainer.appendChild(addBtn);
            }
        };

        const fileInput = h('input', {
            type: 'file',
            accept: 'image/*',
            multiple: true,
            style: 'display: none;',
            onchange: async (e) => {
                const files = Array.from(e.target.files);
                if (!files.length) return;

                const remainingSlots = 4 - this.state.referenceImages.length;
                const filesToProcess = files.slice(0, remainingSlots);

                for (const file of filesToProcess) {
                    try {
                        const dataUrl = await window.Utils.compressReferenceImage(file);
                        this.state.referenceImages.push(dataUrl);
                    } catch (err) {
                        console.error('Failed to process reference image:', err);
                    }
                }

                fileInput.value = ''; // Reset
                updateList();
            }
        });

        container.appendChild(header);
        container.appendChild(listContainer);
        container.appendChild(fileInput);

        updateList();

        return container;
    }

    createCategoryDropdown(categories) {
        const { h } = window.DOM;
        const { colors, mobile } = this;

        const categoryContainer = h('div', {
            style: 'position: relative; width: 100%; z-index: 10;'
        });

        const categoryTriggerText = h('span', {}, this.state.selectedCategory);

        const categoryArrow = h('span', {
            innerHTML: `<svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1L5 5L9 1"/></svg>`,
            style: 'display: flex; align-items: center; transition: transform 0.2s; opacity: 0.6;'
        });

        const categoryTrigger = h('div', {
            style: `width: 100%; padding: ${mobile ? '14px 16px' : '12px 16px'}; border: 1px solid ${colors.inputBorder}; border-radius: 12px; background: ${colors.inputBg}; color: ${colors.text}; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box;`
        }, [categoryTriggerText, categoryArrow]);

        const categoryOptions = h('div', {
            style: `position: absolute; top: 100%; left: 0; margin-top: 8px; width: 100%; background: ${colors.surface}; border: 1px solid ${colors.border}; border-radius: 12px; box-shadow: 0 10px 40px ${colors.shadow}; display: none; flex-direction: column; overflow: hidden; backdrop-filter: blur(20px); max-height: 200px; overflow-y: auto; z-index: 100;`
        });

        const renderOptions = () => {
            categoryOptions.innerHTML = '';
            categories.forEach(cat => {
                const isSelected = cat === this.state.selectedCategory;
                const baseStyle = 'padding: 10px 16px; cursor: pointer; transition: all 0.2s; font-size: 14px;';
                const selectedStyle = isSelected
                    ? `background: ${colors.primary}15; color: ${colors.primary}; font-weight: 600;`
                    : `background: transparent; color: ${colors.text};`;

                const option = h('div', {
                    style: baseStyle + selectedStyle,
                    onmouseenter: (e) => {
                        if (!isSelected) e.target.style.background = colors.surfaceHover;
                        e.target.style.boxShadow = `0 2px 8px ${colors.shadow}`;
                    },
                    onmouseleave: (e) => {
                        if (!isSelected) {
                            e.target.style.background = 'transparent';
                        } else {
                            e.target.style.background = `${colors.primary}15`;
                        }
                        e.target.style.boxShadow = 'none';
                    },
                    onclick: (e) => {
                        e.stopPropagation();
                        this.state.selectedCategory = cat;
                        categoryTriggerText.textContent = cat;
                        categoryOptions.style.display = 'none';
                        categoryArrow.style.transform = 'rotate(0deg)';
                        renderOptions();
                    }
                }, cat);

                categoryOptions.appendChild(option);
            });
        };

        renderOptions();

        categoryTrigger.onclick = (e) => {
            e.stopPropagation();
            const isVisible = categoryOptions.style.display === 'flex';
            categoryOptions.style.display = isVisible ? 'none' : 'flex';
            categoryArrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
        };

        const closeDropdown = (e) => {
            if (!categoryContainer.contains(e.target)) {
                categoryOptions.style.display = 'none';
                categoryArrow.style.transform = 'rotate(0deg)';
            }
        };
        document.addEventListener('click', closeDropdown);
        this.cleanupFns.push(() => document.removeEventListener('click', closeDropdown));

        categoryContainer.appendChild(categoryTrigger);
        categoryContainer.appendChild(categoryOptions);

        return categoryContainer;
    }

    createModeSelection() {
        const { h } = window.DOM;
        const { colors } = this;

        const modeContainer = h('div', {
            style: `display: flex; background: ${colors.inputBg}; padding: 4px; border-radius: 10px; border: 1px solid ${colors.inputBorder};`
        });

        const createOption = (value, label, iconSvg) => {
            const isSelected = this.state.selectedMode === value;
            const option = h('div', {
                style: `flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.2s; font-weight: ${isSelected ? '600' : '400'}; color: ${isSelected ? colors.text : colors.textSecondary}; background: ${isSelected ? colors.surface : 'transparent'}; box-shadow: ${isSelected ? `0 2px 8px ${colors.shadow}` : 'none'};`,
                onclick: () => {
                    this.state.selectedMode = value;
                    const newContainer = this.createModeSelection();
                    modeContainer.parentNode.replaceChild(newContainer, modeContainer);
                }
            });

            const icon = h('span', {
                innerHTML: iconSvg,
                style: 'display: flex; align-items: center;'
            });

            option.appendChild(icon);
            option.appendChild(document.createTextNode(label));
            return option;
        };

        const generateIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
        const editIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;

        modeContainer.appendChild(createOption('generate', '文生图', generateIcon));
        modeContainer.appendChild(createOption('edit', '编辑', editIcon));

        return modeContainer;
    }

    createButtons(existingPrompt, titleInput, promptInput, subCategoryInput) {
        const { h } = window.DOM;
        const { colors, mobile } = this;

        const btnContainer = h('div', {
            style: 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;'
        });

        const cancelBtn = h('button', {
            style: `padding: ${mobile ? '12px 24px' : '10px 20px'}; border: 1px solid ${colors.border}; border-radius: 12px; background: transparent; color: ${colors.text}; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.25s ease;`,
            onclick: () => this.close()
        }, '取消');

        if (!mobile) {
            cancelBtn.onmouseenter = () => {
                cancelBtn.style.background = colors.hover;
                cancelBtn.style.transform = 'scale(1.05)';
            };
            cancelBtn.onmouseleave = () => {
                cancelBtn.style.background = 'transparent';
                cancelBtn.style.transform = 'scale(1)';
            };
        }

        const saveBtn = h('button', {
            style: `padding: ${mobile ? '12px 24px' : '10px 20px'}; border: none; border-radius: 12px; background: ${colors.primary}; color: white; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.25s ease; box-shadow: 0 2px 8px ${colors.shadow};`,
            onclick: async () => {
                const titleVal = titleInput.value.trim();
                const promptVal = promptInput.value.trim();

                if (!titleVal || !promptVal) {
                    alert('请填写标题和内容');
                    return;
                }

                let previewDataUrl = existingPrompt?.preview || 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg';

                if (this.state.selectedFile) {
                    try {
                        saveBtn.textContent = '处理中...';
                        saveBtn.disabled = true;
                        previewDataUrl = await window.Utils.compressImage(this.state.selectedFile);
                    } catch (err) {
                        console.error('图片压缩失败', err);
                        alert('图片处理失败,将使用默认图标');
                    } finally {
                        saveBtn.textContent = '保存';
                        saveBtn.disabled = false;
                    }
                }

                const subCategoryVal = subCategoryInput.value.trim();

                const promptData = {
                    title: titleVal,
                    prompt: promptVal,
                    mode: this.state.selectedMode,
                    category: this.state.selectedCategory,
                    sub_category: subCategoryVal || undefined,
                    preview: previewDataUrl,
                    referenceImages: this.state.referenceImages
                };

                if (this.onSave) {
                    await this.onSave(promptData, existingPrompt);
                }

                this.close();
            }
        }, '保存');

        if (!mobile) {
            saveBtn.onmouseenter = () => {
                saveBtn.style.transform = 'scale(1.05)';
                saveBtn.style.boxShadow = `0 4px 16px ${colors.shadow}`;
            };
            saveBtn.onmouseleave = () => {
                saveBtn.style.transform = 'scale(1)';
                saveBtn.style.boxShadow = `0 2px 8px ${colors.shadow}`;
            };
        }

        btnContainer.appendChild(cancelBtn);
        btnContainer.appendChild(saveBtn);

        return btnContainer;
    }

    close() {
        this.cleanupFns.forEach(fn => fn());
        this.cleanupFns = [];

        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;

        if (this.onCancel) {
            this.onCancel();
        }
    }
};
