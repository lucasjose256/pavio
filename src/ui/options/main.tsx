import { render } from 'preact';
import '../theme.css';
import './options.css';
import { App } from './App';
import { initTheme } from '../shared/theme';

initTheme();
render(<App />, document.getElementById('app')!);
