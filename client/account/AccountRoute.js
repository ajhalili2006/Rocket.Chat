import React, { useEffect } from 'react';

import { useRouteParameter, useRoute } from '../contexts/RouterContext';
import { SideNav } from '../../app/ui-utils';
import AccountProfilePage from './AccountProfilePage';
import AccountPreferencesPage from './preferences/AccountPreferencesPage';
import './sidebarItems';

const AccountRoute = () => {
	const page = useRouteParameter('group');
	const router = useRoute('account');

	useEffect(() => { !page && router.push({ group: 'profile' }); }, [page, router]);

	useEffect(() => {
		SideNav.setFlex('accountFlex');
		SideNav.openFlex();
	});

	return <>
		{{
			profile: <AccountProfilePage />,
			preferences: <AccountPreferencesPage />,
		}[page]}
	</>;
};

export default AccountRoute;
