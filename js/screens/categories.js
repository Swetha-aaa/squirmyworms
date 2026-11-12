import { h, icon } from '../ui/dom.js';
import { CATEGORIES } from '../data/categories.js';
import { wordmark, categoryTile } from './shared.js';

export function renderCategories({ category, onPick, onBack }) {
  return h('main', { class: 'screen screen-mixes' },
    h('header', { class: 'topbar' },
      h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': 'Back', onClick: onBack }, icon('back')),
      wordmark('sm'),
      h('span', {}),
    ),
    h('section', { class: 'mixes-head' },
      h('h1', {}, 'Choose your mix'),
      h('p', { class: 'muted' }, 'Pop is live now. More mixes are on the way.'),
    ),
    h('div', { class: 'tiles tiles-grid' },
      CATEGORIES.map((c, i) =>
        h('div', { class: 'tile-wrap' },
          categoryTile(c, c.id === category.id, onPick, i),
          h('p', { class: 'tile-blurb' }, c.blurb),
        )
      ),
    ),
  );
}
