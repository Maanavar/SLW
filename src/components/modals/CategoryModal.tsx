/**
 * Category Modal Component
 * Create, edit, and delete work type categories
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import './Modals.css';

type CategoryAction = 'add' | 'edit' | 'delete';

export function CategoryModal() {
  const { modal, closeModal } = useUIStore();
  const { categories, addCategory, updateCategory, deleteCategory, workTypes } = useDataStore();
  const toast = useToast();

  const isCategoryModal = modal.isOpen && modal.type === 'category';

  const [action, setAction] = useState<CategoryAction>('add');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editCategoryName, setEditCategoryName] = useState('');

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();

    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      toast.error('Validation', 'Category name is required');
      return;
    }

    if (categories.includes(trimmed)) {
      toast.error('Error', 'This category already exists');
      return;
    }

    try {
      addCategory(trimmed);
      toast.success('Success', `Category "${trimmed}" added successfully`);
      setNewCategoryName('');
    } catch (error) {
      toast.error('Error', 'Failed to add category');
    }
  };

  const handleEditCategory = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedCategory) {
      toast.error('Validation', 'Please select a category to edit');
      return;
    }

    const trimmed = editCategoryName.trim();
    if (!trimmed) {
      toast.error('Validation', 'Category name is required');
      return;
    }

    if (trimmed === selectedCategory) {
      toast.error('Info', 'No changes made');
      return;
    }

    if (categories.includes(trimmed)) {
      toast.error('Error', 'This category name already exists');
      return;
    }

    try {
      updateCategory(selectedCategory, trimmed);
      toast.success('Success', `Category renamed from "${selectedCategory}" to "${trimmed}"`);
      setSelectedCategory('');
      setEditCategoryName('');
      setAction('add');
    } catch (error) {
      toast.error('Error', 'Failed to update category');
    }
  };

  const handleDeleteCategory = () => {
    if (!selectedCategory) {
      toast.error('Validation', 'Please select a category to delete');
      return;
    }

    // Check if category is in use
    const inUse = workTypes.some((wt) => wt.category === selectedCategory);
    if (inUse) {
      toast.error('Error', `Cannot delete "${selectedCategory}" - it has ${workTypes.filter((wt) => wt.category === selectedCategory).length} work type(s)`);
      return;
    }

    if (!window.confirm(`Delete category "${selectedCategory}"? This action cannot be undone.`)) {
      return;
    }

    try {
      deleteCategory(selectedCategory);
      toast.success('Success', `Category "${selectedCategory}" deleted successfully`);
      setSelectedCategory('');
      setAction('add');
    } catch (error) {
      toast.error('Error', 'Failed to delete category');
    }
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setEditCategoryName(cat);
  };

  return (
    <Modal
      isOpen={isCategoryModal}
      onClose={closeModal}
      title="Manage Work Type Categories"
      size="md"
    >
      <div className="category-modal-content">
        <div className="category-actions-tabs">
          <button
            type="button"
            className={`tab-btn ${action === 'add' ? 'active' : ''}`}
            onClick={() => {
              setAction('add');
              setNewCategoryName('');
            }}
          >
            ➕ Add
          </button>
          <button
            type="button"
            className={`tab-btn ${action === 'edit' ? 'active' : ''}`}
            onClick={() => {
              setAction('edit');
              setSelectedCategory('');
              setEditCategoryName('');
            }}
          >
            ✏️ Edit
          </button>
          <button
            type="button"
            className={`tab-btn ${action === 'delete' ? 'active' : ''}`}
            onClick={() => {
              setAction('delete');
              setSelectedCategory('');
            }}
          >
            🗑️ Delete
          </button>
        </div>

        {action === 'add' && (
          <form onSubmit={handleAddCategory} className="modal-form">
            <div className="form-group">
              <label className="form-label" htmlFor="new-category">
                New Category Name
              </label>
              <input
                id="new-category"
                type="text"
                className="form-input"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Bolt Slew, Bolt Thread..."
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Current Categories</label>
              <div className="category-list">
                {[...categories].sort().map((cat) => (
                  <div key={cat} className="category-tag">
                    {cat}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Add Category
              </button>
            </div>
          </form>
        )}

        {action === 'edit' && (
          <form onSubmit={handleEditCategory} className="modal-form">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-category">
                Select Category to Edit
              </label>
              <select
                id="edit-category"
                className="form-input"
                value={selectedCategory}
                onChange={(e) => handleSelectCategory(e.target.value)}
                required
              >
                <option value="">-- Choose a category --</option>
                {[...categories].sort().map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {selectedCategory && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-name">
                    New Name
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    className="form-input"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    placeholder="Enter new category name..."
                    required
                  />
                </div>

                <div className="form-info">
                  <p>
                    Current name: <strong>{selectedCategory}</strong>
                  </p>
                  {workTypes.filter((wt) => wt.category === selectedCategory).length > 0 && (
                    <p className="info-text">
                      This category has{' '}
                      <strong>
                        {workTypes.filter((wt) => wt.category === selectedCategory).length}
                      </strong>{' '}
                      work type(s) - they will be updated automatically.
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!selectedCategory || editCategoryName.trim() === selectedCategory}
              >
                Rename Category
              </button>
            </div>
          </form>
        )}

        {action === 'delete' && (
          <form onSubmit={(e) => { e.preventDefault(); handleDeleteCategory(); }} className="modal-form">
            <div className="form-group">
              <label className="form-label" htmlFor="delete-category">
                Select Category to Delete
              </label>
              <select
                id="delete-category"
                className="form-input"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                required
              >
                <option value="">-- Choose a category --</option>
                {[...categories].sort().map((cat) => {
                  const inUse = workTypes.some((wt) => wt.category === cat);
                  return (
                    <option key={cat} value={cat} disabled={inUse}>
                      {cat}
                      {inUse && ` (In use - ${workTypes.filter((wt) => wt.category === cat).length} work types)`}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedCategory && (
              <div className="form-info">
                <p className="warning-text">
                  ⚠️ Deleting "{selectedCategory}" cannot be undone.
                </p>
                {workTypes.filter((wt) => wt.category === selectedCategory).length > 0 && (
                  <p className="error-text">
                    This category cannot be deleted because it has{' '}
                    <strong>
                      {workTypes.filter((wt) => wt.category === selectedCategory).length}
                    </strong>{' '}
                    work type(s). Please reassign or delete those work types first.
                  </p>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={
                  !selectedCategory ||
                  workTypes.some((wt) => wt.category === selectedCategory)
                }
              >
                Delete Category
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
