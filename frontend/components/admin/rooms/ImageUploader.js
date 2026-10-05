'use client';

import { useRef, useState } from 'react';
import api from '../../../lib/api';
import { errMsg } from '../../../lib/bookingUi';

const MAX_MB = 5; // the API refuses anything larger
const ACCEPTED = /^image\/(jpeg|png|webp)$/;

/**
 * Room photos: drag-and-drop or choose files, reorder, pick the cover.
 * Files are checked before upload (type and size) and uploaded one at a time,
 * in the order they were dropped, with "2 of 5" progress.
 * `images`: the photo addresses, cover first. `onChange(images)`.
 */
export default function ImageUploader({ images, onChange, error, setError }) {
  const [progress, setProgress] = useState(null); // { done, total } while uploading
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const uploadFiles = async (fileList) => {
    const all = Array.from(fileList);
    const wrongType = all.filter((f) => !ACCEPTED.test(f.type));
    const tooBig = all.filter((f) => ACCEPTED.test(f.type) && f.size > MAX_MB * 1024 * 1024);
    const files = all.filter((f) => ACCEPTED.test(f.type) && f.size <= MAX_MB * 1024 * 1024);

    // Say exactly which files were left out, and why, before uploading the rest.
    const skipped = [
      wrongType.length && `${wrongType.map((f) => f.name).join(', ')}: not a JPG, PNG or WEBP`,
      tooBig.length && `${tooBig.map((f) => f.name).join(', ')}: over ${MAX_MB} MB`,
    ].filter(Boolean);
    setError(skipped.length ? `Not uploaded — ${skipped.join('; ')}.` : '');
    if (files.length === 0) return;

    const uploaded = [];
    setProgress({ done: 0, total: files.length });
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        // eslint-disable-next-line no-await-in-loop -- sequential keeps upload order == drop order
        const res = await api.post('/admin/upload-image?type=room', formData);
        uploaded.push(res.data.url);
        setProgress({ done: uploaded.length, total: files.length });
      }
    } catch (err) {
      setError(`${errMsg(err, 'Could not upload a photo')}. ${uploaded.length} of ${files.length} were added.`);
    } finally {
      if (uploaded.length) onChange([...images, ...uploaded]);
      setProgress(null);
    }
  };

  const move = (index, delta) => {
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const makeCover = (index) => {
    if (index === 0) return;
    const next = [...images];
    const [photo] = next.splice(index, 1);
    next.unshift(photo);
    onChange(next);
  };

  const removeAt = (index) => onChange(images.filter((_, i) => i !== index));

  return (
    <div>
      <label className="label">Photos</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm transition ${
          dragOver ? 'border-gold-400 bg-gold-500/10 text-gold-700' : 'border-sand-400 text-ink-400 hover:border-ink-300'
        }`}
      >
        <span role="status">{progress ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : 'Drag photos here, or click to choose files'}</span>
        <input
          ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
          className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }}
        />
      </div>
      <p className="mt-1 text-xs text-ink-400">
        JPG, PNG or WEBP, up to {MAX_MB} MB each. Landscape photos at least 1600 pixels wide look best — guests see them
        full-width. The first photo is the cover.
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}

      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((url, i) => (
            <div key={url} className={`relative overflow-hidden rounded-lg border ${i === 0 ? 'border-gold-400 ring-1 ring-gold-400' : 'border-sand-300'}`}>
              <img src={url} alt="" className="h-20 w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-ocean-500 px-1.5 py-0.5 text-[10px] font-bold text-white">Cover</span>
              )}
              {/* Always visible: a hover-only bar can't be reached on a tablet. */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/65 px-1 py-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`} className="px-1 text-xs text-white disabled:opacity-30">◀</button>
                {i !== 0 && (
                  <button type="button" onClick={() => makeCover(i)} className="px-1 text-[10px] text-gold-200 underline">cover</button>
                )}
                <button type="button" onClick={() => removeAt(i)} aria-label={`Remove photo ${i + 1}`} className="px-1 text-xs text-red-300">✕</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label={`Move photo ${i + 1} later`} className="px-1 text-xs text-white disabled:opacity-30">▶</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
