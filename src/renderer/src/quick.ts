import '@fontsource-variable/inter'
import './styles/base.css'
import { mount } from 'svelte'
import QuickHeader from './QuickHeader.svelte'

mount(QuickHeader, { target: document.getElementById('quick')! })
