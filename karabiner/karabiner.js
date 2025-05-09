#!/usr/bin/env node

function fromTo(from, to) {
	return [
		{
			from: {
				key_code: from,
			},
			to: {
				key_code: to,
			},
		},
	];
}

function genericModifierFN(mod, from, to) {
	const modVar = `${mod}_mod`;
	return [
		{
			from: {
				modifiers: {
					optional: ['any'],
				},
				simultaneous: [
					{
						key_code: mod,
					},
					{
						key_code: from,
					},
				],
				simultaneous_options: {
					key_down_order: 'strict',
					key_up_order: 'strict_inverse',
					to_after_key_up: [
						{
							set_variable: {
								name: modVar,
								value: 0,
							},
						},
					],
				},
			},
			parameters: {
				'basic.simultaneous_threshold_milliseconds': 3000 /* Default: 1000 */,
			},
			to: [
				{
					set_variable: {
						name: modVar,
						value: 1,
					},
				},
				...to,
			],
			type: 'basic',
		},
		{
			conditions: [
				{
					name: modVar,
					type: 'variable_if',
					value: 1,
				},
			],
			from: {
				key_code: from,
				modifiers: {
					optional: ['any'],
				},
			},
			to,
			type: 'basic',
		},
	];
}

function modifierFN(mod, from, to, toMods) {
	const toModifiers = toMods
		? { modifiers: Array.isArray(toMods) ? toMods : [toMods] }
		: {};
	return genericModifierFN(mod, from, [{ key_code: to, ...toModifiers }]);
}

function repeatModifierFN(mod, from, to, toMods, repeatCount) {
	const toModifiers = toMods
		? { modifiers: Array.isArray(toMods) ? toMods : [toMods] }
		: {};
	const toArray = [];
	for (let i = 0; i < repeatCount; i++) {
		toArray.push({ key_code: to, ...toModifiers });
	}
	return genericModifierFN(mod, from, toArray);
}

function spaceFN(from, to, toMods) {
	return modifierFN('spacebar', from, to, toMods);
}

function swap(a, b) {
	return [...fromTo(a, b), ...fromTo(b, a)];
}

const PARAMETER_DEFAULTS = {
	'basic.simultaneous_threshold_milliseconds': 50,
	'basic.to_delayed_action_delay_milliseconds': 500,
	'basic.to_if_alone_timeout_milliseconds': 1000,
	'basic.to_if_held_down_threshold_milliseconds': 500,
};

const VANILLA_PROFILE = {
	complex_modifications: {
		parameters: PARAMETER_DEFAULTS,
		rules: [],
	},
	name: 'Vanilla',
	selected: false,
	simple_modifications: [],
};

const DEFAULT_PROFILE = {
	...VANILLA_PROFILE,
	simple_modifications: [
		{
			from: {
				key_code: 'caps_lock',
			},
			to: [
				{
					key_code: 'left_control',
				},
			],
		},
		{
			from: {
				key_code: 'non_us_backslash',
			},
			to: [
				{
					key_code: 'grave_accent_and_tilde',
				},
			],
		},
		// {
		// 	from: {
		// 		key_code: 'backslash',
		// 	},
		// 	to: [
		// 		{
		// 			key_code: 'return_or_enter',
		// 		},
		// 	],
		// },
	],
	complex_modifications: {
		parameters: {
			...PARAMETER_DEFAULTS,
			'basic.to_if_alone_timeout_milliseconds': 500 /* Default: 1000 */,
		},
		rules: [
			{
				description: 'Numeric qwerty row',
				manipulators: [
					...spaceFN('q', '1'),
					...spaceFN('w', '2'),
					...spaceFN('e', '3'),
					...spaceFN('r', '4'),
					...spaceFN('t', '5'),
					...spaceFN('y', '6'),
					...spaceFN('u', '7'),
					...spaceFN('i', '8'),
					...spaceFN('o', '9'),
					...spaceFN('p', '0'),
				],
			},
			{
				description: 'Brackets and special characters',
				manipulators: [
					...spaceFN('a', '1', 'left_shift'),
					...spaceFN('s', '2', 'left_shift'),
					...spaceFN('d', 'open_bracket'),
					...spaceFN('x', 'close_bracket'),
					...spaceFN('f', 'open_bracket', 'left_shift'),
					...spaceFN('c', 'close_bracket', 'left_shift'),
					...spaceFN('g', 'f12', 'fn'),
					...spaceFN('v', 'hyphen', 'left_control'),
					...spaceFN('h', 'equal_sign', 'left_shift'),
					...spaceFN('n', 'hyphen'),
					...spaceFN('j', 'equal_sign'),
					...spaceFN('k', '8', 'left_shift'),
					...spaceFN('l', '7', 'left_shift'),
					...spaceFN('semicolon', 'backslash', 'left_shift'),
					...spaceFN('m', 'hyphen', 'left_shift'),
					...spaceFN('slash', 'backslash'),
					...spaceFN('z', '6', 'left_shift'),
					...spaceFN('b', '4', 'left_shift'),
					...spaceFN('comma', '3', 'left_shift'),
					...spaceFN('period', '5', 'left_shift'),
					...spaceFN('quote', 'grave_accent_and_tilde'),
					...spaceFN(
						'open_bracket',
						'grave_accent_and_tilde',
						'left_shift'
					),
				],
			},
			{
				description: 'Sloveninan caron character bindings',
				manipulators: [
					...modifierFN('m', 's', 's', ['option']),
					...modifierFN('m', 'z', 'z', ['option']),
					...modifierFN('m', 'c', 'c', ['option']),
					...modifierFN('n', 's', 's', ['option', 'left_shift']),
					...modifierFN('n', 'z', 'z', ['option', 'left_shift']),
					...modifierFN('n', 'c', 'c', ['option', 'left_shift']),
				],
			},
			{
				description: 'Basic movememnt bindings',
				manipulators: [
					// movement by one line character
					...modifierFN('d', 'j', 'left_arrow'),
					...modifierFN('d', 'l', 'right_arrow'),
					...modifierFN('f', 'i', 'up_arrow'),
					...modifierFN('f', 'k', 'down_arrow'),
					...modifierFN('d', 'i', 'up_arrow'),
					...modifierFN('d', 'k', 'down_arrow'),
					// left, right movements by word
					...modifierFN('g', 'j', 'left_arrow', 'option'),
					...modifierFN('f', 'h', 'left_arrow', 'option'),
					...modifierFN('g', 'l', 'right_arrow', 'option'),
					...modifierFN('f', 'semicolon', 'right_arrow', 'option'),
					...modifierFN('f', 'j', 'left_arrow'),
					...modifierFN('f', 'l', 'right_arrow'),
					// left, right movements by 3 words
					...repeatModifierFN('s', 'j', 'left_arrow', 'option', 3),
					...repeatModifierFN('s', 'l', 'right_arrow', 'option', 3),
					// page up, down movements
					...repeatModifierFN('s', 'i', 'page_up', [], 20),
					...repeatModifierFN('s', 'k', 'page_down', [], 20),
					// move to beginning, end of line
					...modifierFN('a', 'j', 'left_arrow', 'left_command'),
					...modifierFN('a', 'l', 'right_arrow', 'left_command'),
					// move to start, end of document
					...modifierFN('a', 'i', 'up_arrow', 'left_command'),
					...modifierFN('a', 'k', 'down_arrow', 'left_command'),
					// vs code to next error
					...modifierFN('t', 'k', 'f8'),
					// vs code to previous error
					...modifierFN('t', 'i', 'f8', ['right_shift']),
				],
			},
			{
				description: 'UI bindings',
				manipulators: [
					// move to left document tab
					// ...modifierFN('t', 'j', 'open_bracket', [
					// 	'left_shift',
					// 	'left_command',
					// ]),
					// // move to right document tab
					// ...modifierFN('t', 'l', 'close_bracket', [
					// 	'left_shift',
					// 	'left_command',
					// ]),
					// cycle trough windows in the application
					...modifierFN('w', 'i', 'grave_accent_and_tilde', [
						'left_command',
					]),
					// cycle trough windows in the application
					...modifierFN('w', 'k', 'grave_accent_and_tilde', [
						'left_command',
						'left_shift',
					]),
					// cycle trough applications forwards
					...modifierFN('w', 'l', 'tab', ['left_command']),
					// cycle trough applications backwards
					...modifierFN('w', 'j', 'tab', ['left_command', 'left_shift']),
					// open enpass
					...modifierFN('j', 'f', 'l', ['left_alt', 'left_command']),
					// copy enpass password
					...modifierFN('j', 'g', 'p', ['left_shift', 'left_command']),
					// copy enpass OTP
					...modifierFN('j', 'h', 't', ['left_shift', 'left_command']),
					...modifierFN('v', 'h', 'f10', ['left_shift']),
					// open raycast
					...modifierFN('f', 'spacebar', 'spacebar', ['left_option']),
					// move to next error in vscode/cursor
					...modifierFN('f', 'm', 'f8', ['fn']),
				],
			},
			{
				description: 'Basic selection bindings',
				manipulators: [
					// select word left
					...modifierFN('e', 'j', 'left_arrow', ['option', 'right_shift']),
					// select word right
					...modifierFN('e', 'l', 'right_arrow', [
						'option',
						'right_shift',
					]),
					// select character left
					...modifierFN('t', 'j', 'left_arrow', ['right_shift']),
					// select character right
					...modifierFN('t', 'l', 'right_arrow', ['right_shift']),
					// expand selection (vs code)
					...modifierFN('r', 'l', 'right_arrow', [
						'left_control',
						'left_shift',
					]),
					// contract selection (vs code)
					...modifierFN('r', 'j', 'left_arrow', [
						'left_control',
						'left_shift',
					]),
					// select line up
					...modifierFN('e', 'i', 'up_arrow', ['right_shift']),
					// select line down
					...modifierFN('e', 'k', 'down_arrow', ['right_shift']),
					// select and copy current line
					...genericModifierFN('f', 'y', [
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'down_arrow',
							modifiers: ['left_shift'],
						},
						{
							key_code: 'c',
							modifiers: ['right_command'],
						},
					]),
					// select line for downward selection movement
					...genericModifierFN('r', 'k', [
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'down_arrow',
							modifiers: ['left_shift'],
						},
					]),
					// select line for upward selection movement
					...genericModifierFN('r', 'i', [
						{
							key_code: 'down_arrow',
							modifiers: [],
						},
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'up_arrow',
							modifiers: ['left_shift'],
						},
					]),
				],
			},
			{
				description: 'Window resizing',
				manipulators: [
					...modifierFN('g', 'i', 'f', ['control', 'fn']),
					...modifierFN('g', 'k', 'c', ['control', 'fn']),
				],
			},
			{
				description: 'Basic deletion and line insetion bindings', // to do here
				manipulators: [
					// delete character backwards, forwards
					...modifierFN('c', 'j', 'delete_or_backspace'),
					...modifierFN('c', 'l', 'delete_or_backspace', ['fn']),
					// insert empty line below
					...genericModifierFN('v', 'k', [
						{
							key_code: 'right_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'return_or_enter',
							modifiers: [],
						},
					]),
					// insert empty line above
					...genericModifierFN('v', 'i', [
						{
							key_code: 'up_arrow',
							modifiers: [],
						},
						{
							key_code: 'right_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'return_or_enter',
							modifiers: [],
						},
					]),
					// delete word left, right
					...modifierFN('v', 'j', 'delete_or_backspace', ['option']),
					...modifierFN('b', 'j', 'delete_or_backspace', ['option']),
					...modifierFN('v', 'l', 'delete_or_backspace', ['option', 'fn']),
					...modifierFN('b', 'l', 'delete_or_backspace', ['option', 'fn']),
					// delete to beginning of line
					...modifierFN('x', 'j', 'delete_or_backspace', ['left_command']),
					// delete to end of line
					...genericModifierFN('x', 'l', [
						{
							key_code: 'right_arrow',
							modifiers: ['left_command', 'right_shift'],
						},
						{
							key_code: 'delete_or_backspace',
							modifiers: [],
						},
					]),
					// delete line and move down
					...genericModifierFN('x', 'k', [
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'down_arrow',
							modifiers: ['left_shift'],
						},
						{
							key_code: 'x',
							modifiers: ['right_command'],
						},
					]),
					// delete line and move up
					...genericModifierFN('x', 'i', [
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'down_arrow',
							modifiers: ['left_shift'],
						},
						{
							key_code: 'x',
							modifiers: ['right_command'],
						},
						{
							key_code: 'up_arrow',
							modifiers: [],
						},
					]),
					// select and cut (to clipboard) current line
					...genericModifierFN('d', 'y', [
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'down_arrow',
							modifiers: ['left_shift'],
						},
						{
							key_code: 'x',
							modifiers: ['right_command'],
						},
					]),
					// duplicate current line
					...genericModifierFN('f', 'u', [
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'down_arrow',
							modifiers: ['left_shift'],
						},
						{
							key_code: 'c',
							modifiers: ['right_command'],
						},
						{
							key_code: 'left_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'v',
							modifiers: ['left_command'],
						},
					]),
				],
			},
			{
				description: 'Toggle CAPS_LOCK with LEFT_SHIFT + RIGHT_SHIFT',
				manipulators: [
					{
						from: {
							key_code: 'left_shift',
							modifiers: {
								mandatory: ['right_shift'],
								optional: ['caps_lock'],
							},
						},
						to: [
							{
								key_code: 'caps_lock',
							},
						],
						to_if_alone: [
							{
								key_code: 'left_shift',
							},
						],
						type: 'basic',
					},
					{
						from: {
							key_code: 'right_shift',
							modifiers: {
								mandatory: ['left_shift'],
								optional: ['caps_lock'],
							},
						},
						to: [
							{
								key_code: 'caps_lock',
							},
						],
						to_if_alone: [
							{
								key_code: 'right_shift',
							},
						],
						type: 'basic',
					},
				],
			},
			{
				description: 'Post Esc if Caps is tapped, Control if held.',
				manipulators: [
					{
						type: 'basic',
						from: {
							key_code: 'left_control',
							modifiers: {
								optional: ['any'],
							},
						},
						to: [
							{
								key_code: 'left_control',
								lazy: true,
							},
						],
						to_if_alone: [
							{
								key_code: 'escape',
							},
						],
					},
				],
			},
			{
				description:
					'Change return to control if pressed with other keys, to return if pressed alone',
				manipulators: [
					{
						from: {
							key_code: 'return_or_enter',
							modifiers: {
								optional: ['any'],
							},
						},
						to: [
							{
								key_code: 'right_control',
							},
						],
						to_if_alone: [
							{
								key_code: 'return_or_enter',
							},
						],
						type: 'basic',
					},
				],
			},
			{
				description: 'Xcode specific',
				manipulators: [
					{
						from: {
							key_code: 't',
							modifiers: {
								mandatory: ['right_control'],
							},
						},
						to: [
							{
								key_code: 't',
							},
							{
								key_code: 'r',
							},
							{
								key_code: 'u',
							},
							{
								key_code: 'e',
							},
						],
						type: 'basic',
					},
					{
						from: {
							key_code: 'f',
							modifiers: {
								mandatory: ['right_control'],
							},
						},
						to: [
							{
								key_code: 'f',
							},
							{
								key_code: 'a',
							},
							{
								key_code: 'l',
							},
							{
								key_code: 's',
							},
							{
								key_code: 'e',
							},
						],
						type: 'basic',
					},
					{
						from: {
							key_code: 's',
							modifiers: {
								mandatory: ['right_control'],
							},
						},
						to: [
							{
								key_code: 's',
							},
							{
								key_code: 'e',
							},
							{
								key_code: 'l',
							},
							{
								key_code: 'f',
							},
							{
								key_code: 'period',
							},
						],
						type: 'basic',
					},
					{
						from: {
							key_code: 'l',
							modifiers: {
								mandatory: ['left_control'],
							},
						},
						to: [
							{
								key_code: 'l',
							},
							{
								key_code: 'e',
							},
							{
								key_code: 't',
							},
							{
								key_code: 'spacebar',
							},
						],
						type: 'basic',
					},
					{
						from: {
							key_code: 'v',
							modifiers: {
								mandatory: ['right_control'],
							},
						},
						to: [
							{
								key_code: 'v',
							},
							{
								key_code: 'a',
							},
							{
								key_code: 'r',
							},
							{
								key_code: 'spacebar',
							},
						],
						type: 'basic',
					},
					{
						from: {
							key_code: 'c',
							modifiers: {
								mandatory: ['right_control'],
							},
						},
						to: [
							{
								key_code: 'c',
							},
							{
								key_code: 'o',
							},
							{
								key_code: 'n',
							},
							{
								key_code: 's',
							},
							{
								key_code: 't',
							},
							{
								key_code: 'spacebar',
							},
						],
						type: 'basic',
					},
					{
						from: {
							key_code: 'w',
							modifiers: {
								mandatory: ['right_control'],
							},
						},
						to: [
							{
								key_code: 's',
							},
							{
								key_code: 'w',
							},
							{
								key_code: 'i',
							},
							{
								key_code: 't',
							},
							{
								key_code: 'c',
							},
							{
								key_code: 'h',
							},
							{
								key_code: 'spacebar',
							},
						],
						type: 'basic',
					},
				],
			},
		],
	},
	name: 'Default',
	selected: true,
};

process.stdout.write(
	JSON.stringify(
		{
			global: {
				check_for_updates_on_startup: true,
				show_in_menu_bar: true,
				show_profile_name_in_menu_bar: false,
			},
			profiles: [DEFAULT_PROFILE, VANILLA_PROFILE],
		},
		null,
		2
	) + '\n'
);
