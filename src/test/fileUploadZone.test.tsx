import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { FileUploadZone } from '@/components/import/FileUploadZone';

vi.mock('@/contexts/TeamContext', () => ({ useTeam: () => ({ currentTeam: null }) }));

// Found on the HQ import (2026-11-25): with "HQ Rental Software — customers" chosen, a non-HQ file was accepted,
// because the upload zone kept calling the wizard's first onFileSelect, which still saw "Detect automatically".
describe('file upload zone', () => {
  it('hands a chosen file to the current onFileSelect, not the first one it was given', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const props = { selectedFile: null, onClear: () => {} };
    const { container, rerender } = render(<FileUploadZone {...props} onFileSelect={first} />);
    rerender(<FileUploadZone {...props} onFileSelect={latest} />);

    const input = container.querySelector('#file-input') as HTMLInputElement;
    const file = new File(['Label,Email Address\n'], 'customers.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(file);
  });
});
